BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (LOWER(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

DO $$ BEGIN
  CREATE TYPE kayan_order_status AS ENUM ('received', 'ready_to_ship', 'on_the_way', 'cancelled', 'delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kayan_fault_status AS ENUM ('received', 'assigned', 'on_the_way', 'in_progress', 'finished', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kayan_service_status AS ENUM ('not_started', 'in_progress', 'cancelled', 'finished');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kayan_fault_severity AS ENUM ('normal', 'high', 'urgent', 'emergent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kayan_service_type AS ENUM ('designing', 'maintenance', 'renewal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kayan_followup_item_type AS ENUM ('order', 'fault', 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kayan_rating_item_type AS ENUM ('order', 'fault', 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS catalog_products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  details JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_assets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'file')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, file_id)
);

CREATE TABLE IF NOT EXISTS product_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_address TEXT NOT NULL,
  status kayan_order_status NOT NULL DEFAULT 'received',
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES catalog_products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  status kayan_order_status NOT NULL,
  changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fault_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity kayan_fault_severity NOT NULL,
  address TEXT NOT NULL,
  status kayan_fault_status NOT NULL DEFAULT 'received',
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fault_assets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fault_id BIGINT NOT NULL REFERENCES fault_reports(id) ON DELETE CASCADE,
  file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fault_id, file_id)
);

CREATE TABLE IF NOT EXISTS fault_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fault_id BIGINT NOT NULL REFERENCES fault_reports(id) ON DELETE CASCADE,
  status kayan_fault_status NOT NULL,
  changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type kayan_service_type NOT NULL,
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  status kayan_service_status NOT NULL DEFAULT 'not_started',
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  status kayan_service_status NOT NULL,
  changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS followup_steps (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_type kayan_followup_item_type NOT NULL,
  item_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  step_image_file_id BIGINT REFERENCES files(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_ratings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type kayan_rating_item_type NOT NULL,
  item_id BIGINT NOT NULL,
  rating_value SMALLINT NOT NULL CHECK (rating_value BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_assets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gallery_item_id BIGINT NOT NULL REFERENCES gallery_items(id) ON DELETE CASCADE,
  file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gallery_item_id, file_id)
);

CREATE TABLE IF NOT EXISTS followup_conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_type kayan_followup_item_type NOT NULL,
  item_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_type, item_id, user_id)
);

CREATE TABLE IF NOT EXISTS followup_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES followup_conversations(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (LENGTH(BTRIM(message_text)) > 0)
);

CREATE INDEX IF NOT EXISTS catalog_products_active_created_idx ON catalog_products(is_active, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_orders_user_created_idx ON product_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fault_reports_user_created_idx ON fault_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_orders_user_created_idx ON service_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS followup_steps_lookup_idx ON followup_steps(item_type, item_id, sort_order, id);
CREATE INDEX IF NOT EXISTS item_ratings_lookup_idx ON item_ratings(item_type, item_id);
CREATE INDEX IF NOT EXISTS gallery_items_active_created_idx ON gallery_items(is_active, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS followup_messages_conv_sent_idx ON followup_messages(conversation_id, sent_at DESC);

COMMIT;
