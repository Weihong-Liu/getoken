-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN github_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_users_github_id;
ALTER TABLE users DROP COLUMN IF EXISTS github_id;
-- +goose StatementEnd
