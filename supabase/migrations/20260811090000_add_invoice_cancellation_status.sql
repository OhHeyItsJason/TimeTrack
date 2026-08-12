-- Keep canceled invoices as an auditable record while reserving their invoice number.
BEGIN;

ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS is_canceled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_date timestamptz;

COMMIT;
