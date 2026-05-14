-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  ratio NUMERIC(8,4) NOT NULL DEFAULT 1,
  note VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO groups (name, ratio, note) VALUES
  ('default', 1.0, '默认分组'),
  ('vip', 0.8, 'VIP 分组')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  username VARCHAR(64) NOT NULL DEFAULT '',
  role VARCHAR(16) NOT NULL DEFAULT 'user',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  group_id BIGINT NOT NULL DEFAULT 1,
  quota NUMERIC(18,6) NOT NULL DEFAULT 0,
  used_quota NUMERIC(18,6) NOT NULL DEFAULT 0,
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  invited_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by);

CREATE TABLE IF NOT EXISTS tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(64) NOT NULL,
  key_hash VARCHAR(128) NOT NULL UNIQUE,
  key_prefix VARCHAR(32) NOT NULL,
  status SMALLINT NOT NULL DEFAULT 1,
  remain_quota NUMERIC(18,6) NOT NULL DEFAULT 0,
  unlimited_quota BOOLEAN NOT NULL DEFAULT FALSE,
  expired_at TIMESTAMPTZ NULL,
  group_id BIGINT NOT NULL DEFAULT 1,
  ip_whitelist TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_group_id ON tokens(group_id);

CREATE TABLE IF NOT EXISTS logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_id BIGINT NULL,
  token_name VARCHAR(64) NOT NULL DEFAULT '',
  type VARCHAR(16) NOT NULL DEFAULT 'request',
  model_name VARCHAR(64) NOT NULL DEFAULT '',
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  quota NUMERIC(18,6) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'success',
  latency_ms INT NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_token_id ON logs(token_id);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_model ON logs(model_name);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs USING BRIN(created_at);

CREATE TABLE IF NOT EXISTS upstreams (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'openai',
  base_url VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'online',
  priority INT NOT NULL DEFAULT 10,
  weight INT NOT NULL DEFAULT 10,
  latency_ms INT NOT NULL DEFAULT 0,
  last_check_at TIMESTAMPTZ NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_mappings (
  id BIGSERIAL PRIMARY KEY,
  model_id VARCHAR(96) NOT NULL UNIQUE,
  vendor VARCHAR(32) NOT NULL DEFAULT '',
  upstream_id BIGINT NOT NULL,
  upstream_model_name VARCHAR(96) NOT NULL,
  input_ratio NUMERIC(8,4) NOT NULL DEFAULT 1,
  output_ratio NUMERIC(8,4) NOT NULL DEFAULT 1,
  context INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'online',
  allowed_groups TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_mappings_upstream ON model_mappings(upstream_id);

CREATE TABLE IF NOT EXISTS redemption_codes (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  amount NUMERIC(18,6) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'unused',
  batch_id VARCHAR(32) NOT NULL DEFAULT '',
  used_by BIGINT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redemption_batch ON redemption_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_redemption_used_by ON redemption_codes(used_by);

CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  level VARCHAR(16) NOT NULL DEFAULT 'info',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  inviter_id BIGINT NOT NULL,
  invitee_id BIGINT NOT NULL,
  reward_quota NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS redemption_codes;
DROP TABLE IF EXISTS model_mappings;
DROP TABLE IF EXISTS upstreams;
DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS groups;
-- +goose StatementEnd
