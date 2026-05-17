-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS upstream_accounts (
  id BIGSERIAL PRIMARY KEY,
  upstream_id BIGINT NOT NULL,
  name VARCHAR(64) NOT NULL,
  api_key VARCHAR(512) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'online',
  priority INT NOT NULL DEFAULT 10,
  weight INT NOT NULL DEFAULT 10,
  rpm_limit INT NOT NULL DEFAULT 0,
  tpm_limit INT NOT NULL DEFAULT 0,
  concurrency_limit INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NULL,
  last_check_at TIMESTAMPTZ NULL,
  last_error TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_upstream_accounts_upstream ON upstream_accounts(upstream_id);
CREATE INDEX IF NOT EXISTS idx_upstream_accounts_dispatch ON upstream_accounts(upstream_id, status, priority DESC, weight DESC, last_used_at ASC NULLS FIRST);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS upstream_accounts;
-- +goose StatementEnd
