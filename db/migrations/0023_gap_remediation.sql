ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE pending_registrations ADD COLUMN address TEXT;
ALTER TABLE item_ratings ADD COLUMN comment TEXT;
ALTER TABLE product_ratings ADD COLUMN comment TEXT;

ALTER TABLE users DROP COLUMN IF EXISTS ssn;
ALTER TABLE pending_registrations DROP COLUMN IF EXISTS ssn;
