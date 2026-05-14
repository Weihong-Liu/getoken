-- +goose Up
-- +goose StatementBegin
ALTER TABLE logs
  ADD COLUMN cached_tokens INT NOT NULL DEFAULT 0,
  ADD COLUMN cache_creation_tokens INT NOT NULL DEFAULT 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE logs
  DROP COLUMN cached_tokens,
  DROP COLUMN cache_creation_tokens;
-- +goose StatementEnd
