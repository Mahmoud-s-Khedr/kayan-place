BEGIN;

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_ratings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  rating_value SMALLINT NOT NULL CHECK (rating_value BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, order_id, product_id)
);

CREATE INDEX IF NOT EXISTS cart_items_user_created_idx
  ON cart_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cart_items_product_idx
  ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS product_ratings_order_product_idx
  ON product_ratings(order_id, product_id);
CREATE INDEX IF NOT EXISTS product_ratings_product_idx
  ON product_ratings(product_id, created_at DESC);

COMMIT;
