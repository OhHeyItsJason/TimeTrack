const fs = require('fs');
const path = require('path');

const IMPORT_DIR = path.join(__dirname, 'base44_csv');
const BACKEND_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(BACKEND_DIR, 'backend_data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const ENTITY_FILES = [
  'Settings.csv',
  'Client.csv',
  'WorkSession.csv',
  'DayMileage.csv',
  'Invoice.csv',
  'InvoiceCounter.csv',
];

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (ch === '"') {
      const next = raw[i + 1];
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && raw[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';

      const isTrailingEmpty = row.length === 1 && row[0] === '';
      if (!isTrailingEmpty) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0];
  const out = [];

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i];
    if (values.length === 1 && values[0] === '') continue;

    const obj = {};
    for (let j = 0; j < headers.length; j += 1) {
      obj[headers[j]] = values[j] != null ? values[j] : '';
    }
    out.push(obj);
  }

  return out;
}

function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  return String(v).toLowerCase() === 'true';
}

function normalizeRow(entity, row) {
  const base = {};
  const sourceCreatedById = row.created_by_id || null;

  Object.keys(row).forEach((key) => {
    if (key === 'created_by' || key === 'created_by_id' || key === 'is_sample') return;
    base[key] = row[key];
  });

  if (!base.id) {
    throw new Error(entity + ' row is missing id');
  }

  base.created_by = 'local-user';
  if (sourceCreatedById) {
    base.source_created_by_id = sourceCreatedById;
  }

  if (!base.created_date) base.created_date = new Date().toISOString();
  if (!base.updated_date) base.updated_date = base.created_date;

  if (entity === 'Settings') {
    base.hourly_rate = toNumber(base.hourly_rate);
  }

  if (entity === 'Client') {
    base.hourly_rate = toNumber(base.hourly_rate);
    base.is_archived = toBool(base.is_archived);
  }

  if (entity === 'WorkSession') {
    base.is_active = toBool(base.is_active);
    base.duration_minutes = toNumber(base.duration_minutes);
    base.break_minutes = toNumber(base.break_minutes) || 0;
  }

  if (entity === 'DayMileage') {
    base.daily_miles_driven = toNumber(base.daily_miles_driven) || 0;
    base.daily_round_trip = toBool(base.daily_round_trip);
  }

  if (entity === 'Invoice') {
    base.total_hours = toNumber(base.total_hours) || 0;
    base.hourly_rate = toNumber(base.hourly_rate) || 0;
    base.total_amount = toNumber(base.total_amount) || 0;
    base.is_submitted = toBool(base.is_submitted);
    base.is_paid = toBool(base.is_paid);
  }

  if (entity === 'InvoiceCounter') {
    base.last_number_used = toInt(base.last_number_used) || 0;
  }

  return base;
}

function ensureDirs() {
  if (!fs.existsSync(IMPORT_DIR)) {
    throw new Error('Import directory not found: ' + IMPORT_DIR);
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function backupDbIfExists() {
  if (!fs.existsSync(DB_FILE)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, 'db.backup.' + stamp + '.json');
  fs.copyFileSync(DB_FILE, backupPath);
  return backupPath;
}

function run() {
  ensureDirs();

  const backupPath = backupDbIfExists();
  const db = {
    Settings: [],
    Client: [],
    WorkSession: [],
    DayMileage: [],
    Invoice: [],
    InvoiceCounter: [],
    Query: [],
  };

  const importedCounts = {};

  ENTITY_FILES.forEach((filename) => {
    const entity = filename.replace('.csv', '');
    const fullPath = path.join(IMPORT_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Missing required CSV file: ' + fullPath);
    }

    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = parseCsv(raw);
    db[entity] = parsed.map((row) => normalizeRow(entity, row));
    importedCounts[entity] = db[entity].length;
  });

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

  console.log('Import complete.');
  if (backupPath) {
    console.log('Backup created at: ' + backupPath);
  }
  Object.keys(importedCounts).forEach((entity) => {
    console.log(entity + ': ' + importedCounts[entity] + ' rows');
  });
  console.log('DB written to: ' + DB_FILE);
}

try {
  run();
} catch (error) {
  console.error('Import failed:', error.message);
  process.exit(1);
}
