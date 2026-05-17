-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(48) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'manual',
  channel VARCHAR(32) NOT NULL,
  amount NUMERIC(18,6) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  pay_url TEXT NOT NULL DEFAULT '',
  qr_content TEXT NOT NULL DEFAULT '',
  provider_ref VARCHAR(128) NOT NULL DEFAULT '',
  expired_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created ON payment_orders(created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS payment_orders;
-- +goose StatementEnd
