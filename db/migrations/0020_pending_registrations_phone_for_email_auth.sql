BEGIN;

ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS phone VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_phone_unique_idx
  ON pending_registrations (phone)
  WHERE phone IS NOT NULL;

COMMIT;
