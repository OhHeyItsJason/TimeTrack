const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'backend_data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 8787);
const ENV_FILE = path.join(__dirname, '.env');

const ENTITY_NAMES = ['Settings', 'Client', 'WorkSession', 'DayMileage', 'Invoice', 'InvoiceCounter', 'Query'];
const AUTH_USER_ID = 'local-user';

function loadDotEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  const raw = fs.readFileSync(ENV_FILE, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '');
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  });
}

loadDotEnv();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@timetrack.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-only-change-this-secret';
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);
const ALLOW_ADMIN_BYPASS = String(process.env.ALLOW_ADMIN_BYPASS || 'false').toLowerCase() === 'true';

function nowIso() {
  return new Date().toISOString();
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const empty = ENTITY_NAMES.reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
  }
}

function loadDb() {
  ensureDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    ENTITY_NAMES.forEach((key) => {
      if (!Array.isArray(parsed[key])) parsed[key] = [];
    });
    return parsed;
  } catch (err) {
    const empty = ENTITY_NAMES.reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
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
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function hmac(input) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(input).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signToken(payloadObj) {
  const payload = b64urlEncode(JSON.stringify(payloadObj));
  const signature = hmac(payload);
  return payload + '.' + signature;
}

function verifyToken(token) {
  if (!token || token.indexOf('.') === -1) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payload = parts[0];
  const signature = parts[1];
  if (hmac(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(b64urlDecode(payload));
    if (!parsed || !parsed.sub || !parsed.exp) return null;
    if (Date.now() >= parsed.exp * 1000) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string') return null;
  if (auth.toLowerCase().indexOf('bearer ') !== 0) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function isLocalRequest(req) {
  const host = (req.headers.host || '').toLowerCase();
  return host.indexOf('localhost') >= 0 || host.indexOf('127.0.0.1') >= 0;
}

function getBypassUser() {
  return {
    sub: AUTH_USER_ID,
    email: ADMIN_EMAIL,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
}

function getAuthUser(req) {
  const token = getBearerToken(req);
  const parsed = token ? verifyToken(token) : null;
  if (parsed) return parsed;

  if (ALLOW_ADMIN_BYPASS && isLocalRequest(req)) {
    return getBypassUser();
  }
  return null;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Id, X-User-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
}

function sendJson(res, status, payload) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendAuthRequired(res) {
  sendJson(res, 401, {
    error: 'Authentication required',
    extra_data: {
      reason: 'auth_required',
    },
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1000000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parsePath(req) {
  const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
  const parts = url.pathname.split('/').filter(Boolean);
  return { url, parts };
}

function sortRows(rows, sortParam) {
  if (!sortParam) return rows;
  const isDesc = sortParam.charAt(0) === '-';
  const field = isDesc ? sortParam.slice(1) : sortParam;
  return rows.slice().sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    if (typeof av === 'number' && typeof bv === 'number') {
      return isDesc ? bv - av : av - bv;
    }

    const as = String(av);
    const bs = String(bv);
    return isDesc ? bs.localeCompare(as) : as.localeCompare(bs);
  });
}

function validateEntityRules(entity, rows, payload, userId, mode, currentId) {
  const opMode = mode || 'create';
  const rowId = currentId || null;

  if (entity === 'Settings') {
    if (opMode === 'create' && rows.some((r) => r.created_by === userId)) {
      return 'Only one Settings record is allowed per user.';
    }
  }

  if (entity === 'WorkSession') {
    if (payload.is_active === true) {
      const activeExists = rows.some((r) => r.created_by === userId && r.is_active && r.id !== rowId);
      if (activeExists) return 'Only one active work session is allowed per user.';
    }

    if (payload.duration_minutes != null && Number(payload.duration_minutes) < 0) {
      return 'duration_minutes must be >= 0.';
    }

    if (payload.break_minutes != null && Number(payload.break_minutes) < 0) {
      return 'break_minutes must be >= 0.';
    }
  }

  if (entity === 'DayMileage') {
    const date = payload.date;
    if (date) {
      const duplicate = rows.some((r) => r.created_by === userId && r.date === date && r.id !== rowId);
      if (duplicate) return 'Only one DayMileage record is allowed per date per user.';
    }
  }

  if (entity === 'Invoice') {
    const invoiceNumber = payload.invoice_number;
    if (invoiceNumber) {
      const duplicate = rows.some((r) => r.created_by === userId && r.invoice_number === invoiceNumber && r.id !== rowId);
      if (duplicate) return 'Invoice number must be unique per user.';
    }
  }

  if (entity === 'InvoiceCounter') {
    const clientId = payload.client_id;
    if (clientId) {
      const duplicate = rows.some((r) => r.created_by === userId && r.client_id === clientId && r.id !== rowId);
      if (duplicate) return 'Only one InvoiceCounter record is allowed per client per user.';
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = parsePath(req);
  const url = parsed.url;
  const parts = parsed.parts;
  if (req.method === 'GET' && parts.length === 2 && parts[0] === 'api' && parts[1] === 'health') {
    sendJson(res, 200, { ok: true, timestamp: nowIso() });
    return;
  }

  if (req.method === 'GET' && /^\/api\/apps\/public\/prod\/public-settings\/by-id\/.+/.test(url.pathname)) {
    const id = url.pathname.split('/').pop();
    sendJson(res, 200, {
      id,
      public_settings: {
        requires_auth: true,
      },
    });
    return;
  }

  if (req.method === 'POST' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'login') {
    try {
      const body = await readJsonBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (email !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
        sendJson(res, 401, { error: 'Invalid email or password' });
        return;
      }

      const payload = {
        sub: AUTH_USER_ID,
        email: ADMIN_EMAIL,
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      };
      const token = signToken(payload);
      sendJson(res, 200, {
        access_token: token,
        user: {
          id: AUTH_USER_ID,
          email: ADMIN_EMAIL,
          name: 'Admin',
          role: 'admin',
        },
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Bad request' });
    }
    return;
  }

  if (req.method === 'GET' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'me') {
    const authUser = getAuthUser(req);
    if (!authUser) {
      sendAuthRequired(res);
      return;
    }

    sendJson(res, 200, {
      id: authUser.sub,
      email: authUser.email || ADMIN_EMAIL,
      name: 'Admin',
      role: 'admin',
    });
    return;
  }

  if (req.method === 'POST' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'app-logs' && parts[2] === 'log-user-in-app') {
    const authUser = getAuthUser(req);
    if (!authUser) {
      sendAuthRequired(res);
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  const isEntityBase = parts.length >= 3 && parts[0] === 'api' && parts[1] === 'entities';
  if (!isEntityBase) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const entity = parts[2];
  if (ENTITY_NAMES.indexOf(entity) === -1) {
    sendJson(res, 404, { error: 'Unknown entity: ' + entity });
    return;
  }
  const authUser = getAuthUser(req);
  if (!authUser) {
    sendAuthRequired(res);
    return;
  }
  const userId = authUser.sub;

  const db = loadDb();
  const rows = db[entity];

  if (req.method === 'GET' && parts.length === 3) {
    const sort = url.searchParams.get('sort') || '';
    const scoped = rows.filter((r) => r.created_by === userId);
    sendJson(res, 200, sortRows(scoped, sort));
    return;
  }

  if (req.method === 'GET' && parts.length === 4 && parts[3] === 'filter') {
    const filters = {};
    url.searchParams.forEach((value, key) => {
      filters[key] = value;
    });

    const scoped = rows.filter((r) => r.created_by === userId);
    const filtered = scoped.filter((row) => {
      return Object.keys(filters).every((key) => String(row[key]) === filters[key]);
    });

    sendJson(res, 200, filtered);
    return;
  }

  if (req.method === 'POST' && parts.length === 3) {
    try {
      const payload = await readJsonBody(req);
      const violation = validateEntityRules(entity, rows, payload, userId, 'create', null);
      if (violation) {
        sendJson(res, 400, { error: violation });
        return;
      }

      const row = Object.assign(
        {
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + String(Math.random()).slice(2),
          created_by: userId,
          created_date: nowIso(),
          updated_date: nowIso(),
        },
        payload
      );

      rows.push(row);
      saveDb(db);
      sendJson(res, 201, row);
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Bad request' });
    }
    return;
  }

  if (req.method === 'PATCH' && parts.length === 4) {
    const id = parts[3];
    const index = rows.findIndex((r) => r.id === id && r.created_by === userId);
    if (index === -1) {
      sendJson(res, 404, { error: 'Record not found' });
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const next = Object.assign({}, rows[index], payload, { updated_date: nowIso() });
      const violation = validateEntityRules(entity, rows, next, userId, 'update', id);
      if (violation) {
        sendJson(res, 400, { error: violation });
        return;
      }

      rows[index] = next;
      saveDb(db);
      sendJson(res, 200, next);
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Bad request' });
    }
    return;
  }

  if (req.method === 'DELETE' && parts.length === 4) {
    const id = parts[3];
    const index = rows.findIndex((r) => r.id === id && r.created_by === userId);
    if (index === -1) {
      sendJson(res, 404, { error: 'Record not found' });
      return;
    }
    const deleted = rows.splice(index, 1)[0];
    saveDb(db);
    sendJson(res, 200, deleted);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log('[backend] listening on http://localhost:' + PORT);
  console.log('[backend] data file: ' + DB_FILE);
  console.log('[backend] auth enabled for: ' + ADMIN_EMAIL);
  if (ADMIN_PASSWORD === 'changeme123') {
    console.log('[backend] WARNING: Using default admin password. Set ADMIN_PASSWORD in backend/.env');
  }
  if (ALLOW_ADMIN_BYPASS) {
    console.log('[backend] WARNING: ALLOW_ADMIN_BYPASS is enabled for localhost requests.');
  }
});
