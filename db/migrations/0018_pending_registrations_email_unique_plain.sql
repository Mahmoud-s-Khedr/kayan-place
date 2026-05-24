BEGIN;

UPDATE pending_registrations
SET email = LOWER(email)
WHERE email IS NOT NULL AND email <> LOWER(email);

DROP INDEX IF EXISTS pending_registrations_email_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_email_unique_plain_idx
  ON pending_registrations (email);

DROP INDEX IF EXISTS pending_registrations_email_idx;
CREATE INDEX IF NOT EXISTS pending_registrations_email_expires_idx
  ON pending_registrations (email, expires_at DESC);

COMMIT;
