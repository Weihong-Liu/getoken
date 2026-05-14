-- +goose Up
-- +goose StatementBegin
ALTER TABLE model_mappings
  ADD COLUMN cached_price NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN cache_creation_price NUMERIC(12,6) NOT NULL DEFAULT 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE model_mappings
  DROP COLUMN cached_price,
  DROP COLUMN cache_creation_price;
-- +goose StatementEnd
