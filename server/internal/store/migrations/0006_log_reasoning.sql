-- +goose Up
-- +goose StatementBegin
ALTER TABLE logs
  ADD COLUMN reasoning_effort VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN reasoning_tokens INT NOT NULL DEFAULT 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE logs
  DROP COLUMN reasoning_effort,
  DROP COLUMN reasoning_tokens;
-- +goose StatementEnd
