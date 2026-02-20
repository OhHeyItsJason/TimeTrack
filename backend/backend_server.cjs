const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'backend_data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 8787);

const ENTITY_NAMES = ['Settings', 'Client', 'WorkSession', 'DayMileage', 'Invoice', 'InvoiceCounter', 'Query'];

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

function getUserId(req) {
  const headerUser = req.headers['x-user-id'];
  if (typeof headerUser === 'string' && headerUser.trim()) return headerUser.trim();

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().indexOf('bearer ') === 0) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  return 'local-user';
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
  const userId = getUserId(req);

  if (req.method === 'GET' && parts.length === 2 && parts[0] === 'api' && parts[1] === 'health') {
    sendJson(res, 200, { ok: true, timestamp: nowIso() });
    return;
  }

  if (req.method === 'GET' && /^\/api\/apps\/public\/prod\/public-settings\/by-id\/.+/.test(url.pathname)) {
    const id = url.pathname.split('/').pop();
    sendJson(res, 200, {
      id,
      public_settings: {
        requires_auth: false,
      },
    });
    return;
  }

  if (req.method === 'GET' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'me') {
    sendJson(res, 200, {
      id: userId,
      email: 'local@example.com',
      name: 'Local User',
      role: 'admin',
    });
    return;
  }

  if (req.method === 'POST' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'app-logs' && parts[2] === 'log-user-in-app') {
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
});
