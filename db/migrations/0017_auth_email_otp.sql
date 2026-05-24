BEGIN;

ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE pending_registrations SET email = LOWER(phone || '@legacy.local') WHERE email IS NULL;
ALTER TABLE pending_registrations ALTER COLUMN email SET NOT NULL;
DROP INDEX IF EXISTS pending_registrations_phone_idx;
DROP INDEX IF EXISTS pending_registrations_phone_unique_idx;
CREATE INDEX IF NOT EXISTS pending_registrations_email_idx
  ON pending_registrations (LOWER(email), expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_email_unique_idx
  ON pending_registrations (LOWER(email));
ALTER TABLE pending_registrations DROP COLUMN IF EXISTS phone;

ALTER TABLE auth_otps ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE auth_otps SET email = LOWER(phone || '@legacy.local') WHERE email IS NULL;
ALTER TABLE auth_otps ALTER COLUMN email SET NOT NULL;
DROP INDEX IF EXISTS auth_otps_phone_purpose_created_idx;
CREATE INDEX IF NOT EXISTS auth_otps_email_purpose_created_idx
  ON auth_otps (LOWER(email), purpose, created_at DESC);
ALTER TABLE auth_otps DROP COLUMN IF EXISTS phone;

ALTER TABLE auth_otp_attempts ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE auth_otp_attempts SET email = LOWER(phone || '@legacy.local') WHERE email IS NULL;
ALTER TABLE auth_otp_attempts ALTER COLUMN email SET NOT NULL;
ALTER TABLE auth_otp_attempts DROP CONSTRAINT IF EXISTS auth_otp_attempts_pkey;
ALTER TABLE auth_otp_attempts ADD CONSTRAINT auth_otp_attempts_pkey PRIMARY KEY (email, purpose);
ALTER TABLE auth_otp_attempts DROP COLUMN IF EXISTS phone;

COMMIT;
