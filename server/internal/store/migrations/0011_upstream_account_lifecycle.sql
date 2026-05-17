-- +goose Up
-- +goose StatementBegin
ALTER TABLE upstream_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) NOT NULL DEFAULT 'apikey';
ALTER TABLE upstream_accounts ADD COLUMN IF NOT EXISTS oauth_access_token TEXT NOT NULL DEFAULT '';
ALTER TABLE upstream_accounts ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT NOT NULL DEFAULT '';
ALTER TABLE upstream_accounts ADD COLUMN IF NOT EXISTS oauth_expires_at TIMESTAMPTZ NULL;
ALTER TABLE upstream_accounts ADD COLUMN IF NOT EXISTS proxy_url VARCHAR(255) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_upstream_accounts_type ON upstream_accounts(account_type);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_upstream_accounts_type;
ALTER TABLE upstream_accounts DROP COLUMN IF EXISTS proxy_url;
ALTER TABLE upstream_accounts DROP COLUMN IF EXISTS oauth_expires_at;
ALTER TABLE upstream_accounts DROP COLUMN IF EXISTS oauth_refresh_token;
ALTER TABLE upstream_accounts DROP COLUMN IF EXISTS oauth_access_token;
ALTER TABLE upstream_accounts DROP COLUMN IF EXISTS account_type;
-- +goose StatementEnd
