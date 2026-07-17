-- Preserve existing invoices while recording exact future submission and payment dates.
BEGIN;

ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS submitted_date timestamptz,
  ADD COLUMN IF NOT EXISTS paid_date timestamptz;

COMMIT;
