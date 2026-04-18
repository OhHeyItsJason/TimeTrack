import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const ENTITY_NAMES = ['Settings', 'Client', 'WorkSession', 'DayMileage', 'Invoice', 'InvoiceCounter', 'Query'];
const AUTH_USER_ID = 'local-user';
const ENTITY_TABLES = {
  Settings: 'settings',
  Client: 'client',
  WorkSession: 'work_session',
  DayMileage: 'day_mileage',
  Invoice: 'invoice',
  InvoiceCounter: 'invoice_counter',
  Query: 'query_record',
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@timetrack.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-only-change-this-secret';
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are not configured.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function b64urlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecode(str) {
  const padded = str + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function hmacSign(input) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(input).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signToken(payloadObj) {
  const payload = b64urlEncode(JSON.stringify(payloadObj));
  return payload + '.' + hmacSign(payload);
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (hmacSign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(payload));
    if (!parsed?.sub || !parsed?.exp) return null;
    if (Date.now() >= parsed.exp * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getAuthUser(req) {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token ? verifyToken(token) : null;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Id, X-User-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
}

function sendJson(res, status, payload) {
  setCors(res);
  res.status(status).json(payload);
}

function sendAuthRequired(res) {
  sendJson(res, 401, { error: 'Authentication required', extra_data: { reason: 'auth_required' } });
}

// --- Supabase CRUD ---

async function loadEntityRows(db, entity, userId, sortParam) {
  const table = ENTITY_TABLES[entity];
  let query = db.from(table).select('*').eq('created_by', userId);
  if (sortParam) {
    const isDesc = sortParam.charAt(0) === '-';
    const field = isDesc ? sortParam.slice(1) : sortParam;
    query = query.order(field, { ascending: !isDesc });
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function filterEntityRows(db, entity, userId, filters) {
  const table = ENTITY_TABLES[entity];
  let query = db.from(table).select('*').eq('created_by', userId);
  for (const key of Object.keys(filters)) {
    query = query.eq(key, filters[key]);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function getEntityRowById(db, entity, userId, id) {
  const table = ENTITY_TABLES[entity];
  const { data, error } = await db
    .from(table).select('*')
    .eq('id', id).eq('created_by', userId)
    .limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function createEntityRow(db, entity, userId, payload) {
  const row = {
    id: crypto.randomUUID(),
    created_by: userId,
    created_date: nowIso(),
    updated_date: nowIso(),
    ...payload,
  };
  const table = ENTITY_TABLES[entity];
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateEntityRow(db, entity, userId, id, payload) {
  const existing = await getEntityRowById(db, entity, userId, id);
  if (!existing) return null;
  const next = { ...existing, ...payload, updated_date: nowIso() };
  const table = ENTITY_TABLES[entity];
  const { data, error } = await db
    .from(table).update(next)
    .eq('id', id).eq('created_by', userId)
    .select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteEntityRow(db, entity, userId, id) {
  const existing = await getEntityRowById(db, entity, userId, id);
  if (!existing) return null;
  const table = ENTITY_TABLES[entity];
  const { error } = await db.from(table).delete().eq('id', id).eq('created_by', userId);
  if (error) throw new Error(error.message);
  return existing;
}

function validateEntityRules(entity, rows, payload, userId, mode, currentId) {
  if (entity === 'Settings') {
    if (mode === 'create' && rows.some((r) => r.created_by === userId)) {
      return 'Only one Settings record is allowed per user.';
    }
  }
  if (entity === 'WorkSession') {
    if (payload.is_active === true) {
      if (rows.some((r) => r.created_by === userId && r.is_active && r.id !== currentId)) {
        return 'Only one active work session is allowed per user.';
      }
    }
    if (payload.duration_minutes != null && Number(payload.duration_minutes) < 0) {
      return 'duration_minutes must be >= 0.';
    }
    if (payload.break_minutes != null && Number(payload.break_minutes) < 0) {
      return 'break_minutes must be >= 0.';
    }
  }
  if (entity === 'DayMileage') {
    if (payload.date) {
      if (rows.some((r) => r.created_by === userId && r.date === payload.date && r.id !== currentId)) {
        return 'Only one DayMileage record is allowed per date per user.';
      }
    }
  }
  if (entity === 'Invoice') {
    if (payload.invoice_number) {
      if (rows.some((r) => r.created_by === userId && r.invoice_number === payload.invoice_number && r.id !== currentId)) {
        return 'Invoice number must be unique per user.';
      }
    }
  }
  if (entity === 'InvoiceCounter') {
    if (payload.client_id) {
      if (rows.some((r) => r.created_by === userId && r.client_id === payload.client_id && r.id !== currentId)) {
        return 'Only one InvoiceCounter record is allowed per client per user.';
      }
    }
  }
  return null;
}

// --- Main handler ---

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const rawPath = req.query.path;
  const parts = (Array.isArray(rawPath) ? rawPath : [rawPath])
    .filter(Boolean)
    .flatMap((value) => String(value).split('/'))
    .filter(Boolean);

  // GET /api/health
  if (req.method === 'GET' && parts.length === 1 && parts[0] === 'health') {
    sendJson(res, 200, { ok: true, timestamp: nowIso(), storage: 'supabase' });
    return;
  }

  // GET /api/apps/public/prod/public-settings/by-id/:id
  if (req.method === 'GET' && parts[0] === 'apps' && parts[4] === 'by-id') {
    const id = parts[5] || '';
    sendJson(res, 200, { id, public_settings: { requires_auth: true } });
    return;
  }

  // POST /api/auth/login
  if (req.method === 'POST' && parts.length === 2 && parts[0] === 'auth' && parts[1] === 'login') {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (email !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: 'Invalid email or password' });
      return;
    }
    const tokenPayload = {
      sub: AUTH_USER_ID,
      email: ADMIN_EMAIL,
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };
    sendJson(res, 200, {
      access_token: signToken(tokenPayload),
      user: { id: AUTH_USER_ID, email: ADMIN_EMAIL, name: 'Admin', role: 'admin' },
    });
    return;
  }

  // GET /api/auth/me
  if (req.method === 'GET' && parts.length === 2 && parts[0] === 'auth' && parts[1] === 'me') {
    const authUser = getAuthUser(req);
    if (!authUser) { sendAuthRequired(res); return; }
    sendJson(res, 200, { id: authUser.sub, email: authUser.email || ADMIN_EMAIL, name: 'Admin', role: 'admin' });
    return;
  }

  // POST /api/app-logs/log-user-in-app
  if (req.method === 'POST' && parts[0] === 'app-logs' && parts[1] === 'log-user-in-app') {
    const authUser = getAuthUser(req);
    if (!authUser) { sendAuthRequired(res); return; }
    sendJson(res, 200, { ok: true });
    return;
  }

  // All entity routes
  if (parts[0] !== 'entities') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const entity = parts[1];
  if (!entity || !ENTITY_NAMES.includes(entity)) {
    sendJson(res, 404, { error: 'Unknown entity: ' + entity });
    return;
  }

  const authUser = getAuthUser(req);
  if (!authUser) { sendAuthRequired(res); return; }
  const userId = authUser.sub;

  let db;
  try {
    db = getSupabaseClient();
  } catch (err) {
    sendJson(res, 500, { error: err.message });
    return;
  }

  try {
    // GET /api/entities/:entity
    if (req.method === 'GET' && parts.length === 2) {
      const rows = await loadEntityRows(db, entity, userId, req.query.sort || '');
      sendJson(res, 200, rows);
      return;
    }

    // GET /api/entities/:entity/filter
    if (req.method === 'GET' && parts.length === 3 && parts[2] === 'filter') {
      const filters = { ...req.query };
      delete filters.path;
      const rows = await filterEntityRows(db, entity, userId, filters);
      sendJson(res, 200, rows);
      return;
    }

    // POST /api/entities/:entity
    if (req.method === 'POST' && parts.length === 2) {
      const payload = req.body || {};
      const rowsForValidation = await loadEntityRows(db, entity, userId, '');
      const violation = validateEntityRules(entity, rowsForValidation, payload, userId, 'create', null);
      if (violation) { sendJson(res, 400, { error: violation }); return; }
      const created = await createEntityRow(db, entity, userId, payload);
      sendJson(res, 201, created);
      return;
    }

    // PATCH /api/entities/:entity/:id
    if (req.method === 'PATCH' && parts.length === 3 && parts[2] !== 'filter') {
      const id = parts[2];
      const existing = await getEntityRowById(db, entity, userId, id);
      if (!existing) { sendJson(res, 404, { error: 'Record not found' }); return; }
      const payload = req.body || {};
      const next = { ...existing, ...payload, updated_date: nowIso() };
      const rowsForValidation = await loadEntityRows(db, entity, userId, '');
      const violation = validateEntityRules(entity, rowsForValidation, next, userId, 'update', id);
      if (violation) { sendJson(res, 400, { error: violation }); return; }
      const updated = await updateEntityRow(db, entity, userId, id, payload);
      sendJson(res, 200, updated);
      return;
    }

    // DELETE /api/entities/:entity/:id
    if (req.method === 'DELETE' && parts.length === 3 && parts[2] !== 'filter') {
      const id = parts[2];
      const deleted = await deleteEntityRow(db, entity, userId, id);
      if (!deleted) { sendJson(res, 404, { error: 'Record not found' }); return; }
      sendJson(res, 200, deleted);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}
