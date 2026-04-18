/**
 * import_legacy_csv_exports_to_supabase.cjs
 *
 * Purpose:
 * Re-import legacy CSV exports into Supabase after additional data has been
 * added to the old system and TimeTrack needs a controlled resync.
 *
 * Expected input folders:
 * - Preferred: backend/import/legacy_csv_exports/
 * - Fallback: backend/import/legacy_csv/
 * - Backward-compatible fallback: backend/import/base44_csv/
 *
 * Expected files:
 * - Settings.csv
 * - Client.csv
 * - WorkSession_export-2.csv
 * - DayMileage_export-2.csv
 * - Invoice_export-2.csv
 * - InvoiceCounter_export-2.csv
 *
 * Run from repo root:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
 *   node backend/import/import_legacy_csv_exports_to_supabase.cjs
 *
 * Safety:
 * - This is a migration/import script, not part of the deployed app path.
 * - It replaces imported rows for created_by=local-user in Supabase.
 * - Keep the Supabase secret key server-only and never commit it.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars before running.');
  process.exit(1);
}

const PRIMARY_EXPORTS_DIR = path.join(__dirname, 'legacy_csv_exports');
const SECONDARY_EXPORTS_DIR = path.join(__dirname, 'legacy_csv');
const FALLBACK_EXPORTS_DIR = path.join(__dirname, 'base44_csv');
const EXPORTS_DIR = fs.existsSync(PRIMARY_EXPORTS_DIR)
  ? PRIMARY_EXPORTS_DIR
  : fs.existsSync(SECONDARY_EXPORTS_DIR)
    ? SECONDARY_EXPORTS_DIR
    : FALLBACK_EXPORTS_DIR;

const CSV_FILES = {
  Settings:       'Settings.csv',
  Client:         'Client.csv',
  WorkSession:    'WorkSession_export-2.csv',
  DayMileage:     'DayMileage_export-2.csv',
  Invoice:        'Invoice_export-2.csv',
  InvoiceCounter: 'InvoiceCounter_export-2.csv',
};

const TABLE_MAP = {
  Settings:       'settings',
  Client:         'client',
  WorkSession:    'work_session',
  DayMileage:     'day_mileage',
  Invoice:        'invoice',
  InvoiceCounter: 'invoice_counter',
};

// ── CSV parser (handles quoted fields and escaped quotes) ──────────────────

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') { cell += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && raw[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1)
    .filter(r => !(r.length === 1 && r[0] === ''))
    .map(values => {
      const obj = {};
      headers.forEach((h, j) => { obj[h] = values[j] != null ? values[j] : ''; });
      return obj;
    });
}

// ── Type helpers ───────────────────────────────────────────────────────────

function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function toInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  return String(v).toLowerCase() === 'true';
}
function toTimestamp(v) {
  if (!v || v === '') return null;
  // Reject bare time strings like "08:00"
  if (!v.includes('T') && !v.match(/^\d{4}-\d{2}-\d{2}/)) return null;
  return v;
}

// ── Record normalizer (mirrors import_legacy_csv.cjs logic) ───────────────

function normalizeRow(entity, row) {
  const base = {};

  // Strip columns not in schema; capture source_created_by_id from created_by_id
  const sourceId = row.created_by_id || null;
  Object.keys(row).forEach(key => {
    if (['created_by', 'created_by_id', 'is_sample'].includes(key)) return;
    base[key] = row[key];
  });

  if (!base.id) throw new Error(`${entity} row missing id`);

  base.created_by = 'local-user';
  if (sourceId) base.source_created_by_id = sourceId;
  if (!base.created_date) base.created_date = new Date().toISOString();
  if (!base.updated_date) base.updated_date = base.created_date;

  // Timestamp fields: null-out empty or invalid values
  ['start_time', 'end_time', 'generated_date', 'created_date', 'updated_date'].forEach(f => {
    if (f in base) base[f] = toTimestamp(base[f]);
  });

  if (entity === 'WorkSession') {
    base.is_active = toBool(base.is_active);
    base.duration_minutes = toNumber(base.duration_minutes);
    base.break_minutes = toNumber(base.break_minutes) ?? 0;
  }
  if (entity === 'DayMileage') {
    base.daily_miles_driven = toNumber(base.daily_miles_driven) ?? 0;
    base.daily_round_trip = toBool(base.daily_round_trip);
  }
  if (entity === 'Invoice') {
    base.total_hours = toNumber(base.total_hours) ?? 0;
    base.hourly_rate = toNumber(base.hourly_rate) ?? 0;
    base.total_amount = toNumber(base.total_amount) ?? 0;
    base.is_submitted = toBool(base.is_submitted);
    base.is_paid = toBool(base.is_paid);
  }
  if (entity === 'InvoiceCounter') {
    base.last_number_used = toInt(base.last_number_used) ?? 0;
  }

  return base;
}

// ── Normalize all records to same key set ─────────────────────────────────

function normalizeRecords(records) {
  const allKeys = new Set();
  records.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  return records.map(r => {
    const out = { ...r };
    for (const key of allKeys) if (!(key in out)) out[key] = null;
    return out;
  });
}

// ── Supabase helpers ───────────────────────────────────────────────────────

async function deleteTable(tableName) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?created_by=eq.local-user`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${tableName} delete failed (${res.status}): ${text}`);
  }
}

async function insertTable(tableName, records) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(normalizeRecords(records)),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${tableName} insert failed (${res.status}): ${text}`);
  }
}

async function replaceTable(tableName, records) {
  if (!records.length) { console.log(`  ${tableName}: skipped (0 records)`); return; }
  await deleteTable(tableName);
  await insertTable(tableName, records);
  console.log(`  ${tableName}: ${records.length} records replaced ✓`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    throw new Error(
      'No legacy CSV export folder found. Expected backend/import/legacy_csv_exports, backend/import/legacy_csv, or backend/import/base44_csv.'
    );
  }

  console.log(`Parsing legacy CSV exports from ${EXPORTS_DIR}...`);
  for (const [entity, filename] of Object.entries(CSV_FILES)) {
    const filePath = path.join(EXPORTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  WARNING: ${filename} not found, skipping`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = parseCsv(raw);
    const records = parsed.map(row => normalizeRow(entity, row));
    await replaceTable(TABLE_MAP[entity], records);
  }
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
