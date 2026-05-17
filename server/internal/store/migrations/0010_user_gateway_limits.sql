-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN IF NOT EXISTS concurrency_limit INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rpm_limit INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tpm_limit INT NOT NULL DEFAULT 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users DROP COLUMN IF EXISTS tpm_limit;
ALTER TABLE users DROP COLUMN IF EXISTS rpm_limit;
ALTER TABLE users DROP COLUMN IF EXISTS concurrency_limit;
-- +goose StatementEnd
