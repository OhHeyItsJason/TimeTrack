BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY,
  hourly_rate numeric,
  company_name text,
  email text,
  phone text,
  address text,
  invoice_notes text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  source_created_by_id text
);

CREATE TABLE IF NOT EXISTS client (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  hourly_rate numeric,
  abbreviation text,
  color text,
  is_archived boolean NOT NULL DEFAULT false,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  source_created_by_id text
);

CREATE TABLE IF NOT EXISTS work_session (
  id text PRIMARY KEY,
  date text NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes numeric,
  break_minutes numeric,
  is_active boolean NOT NULL DEFAULT false,
  client_id text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  source_created_by_id text
);

CREATE TABLE IF NOT EXISTS day_mileage (
  id text PRIMARY KEY,
  date text NOT NULL,
  daily_miles_driven numeric NOT NULL DEFAULT 0,
  daily_round_trip boolean NOT NULL DEFAULT false,
  daily_mileage_notes text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  source_created_by_id text
);

CREATE TABLE IF NOT EXISTS invoice (
  id text PRIMARY KEY,
  invoice_number text NOT NULL,
  client_name text,
  client_email text,
  client_phone text,
  client_address text,
  start_date text,
  end_date text,
  selected_dates text,
  line_items text,
  invoice_format text,
  total_hours numeric,
  hourly_rate numeric,
  total_amount numeric,
  notes text,
  is_submitted boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT false,
  generated_date timestamptz,
  client_abbreviation text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  source_created_by_id text
);

CREATE TABLE IF NOT EXISTS invoice_counter (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  last_number_used integer NOT NULL DEFAULT 0,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  source_created_by_id text
);

CREATE TABLE IF NOT EXISTS query_record (
  id text PRIMARY KEY,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  source_created_by_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS settings_created_by_unique
  ON settings (created_by);

CREATE UNIQUE INDEX IF NOT EXISTS day_mileage_created_by_date_unique
  ON day_mileage (created_by, date);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_created_by_invoice_number_unique
  ON invoice (created_by, invoice_number);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_counter_created_by_client_unique
  ON invoice_counter (created_by, client_id);

CREATE INDEX IF NOT EXISTS work_session_created_by_idx
  ON work_session (created_by);

CREATE INDEX IF NOT EXISTS invoice_created_by_idx
  ON invoice (created_by);

CREATE INDEX IF NOT EXISTS client_created_by_idx
  ON client (created_by);

COMMIT;
