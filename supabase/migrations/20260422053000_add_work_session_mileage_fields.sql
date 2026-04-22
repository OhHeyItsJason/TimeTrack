BEGIN;

ALTER TABLE public.work_session
  ADD COLUMN IF NOT EXISTS session_miles_driven numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_round_trip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_mileage_notes text;

COMMIT;
