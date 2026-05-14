-- +goose Up
-- +goose StatementBegin
-- 把 model_mappings 的 ratio 字段重命名为 price，语义改成 "USD per 1M tokens"。
ALTER TABLE model_mappings
  ALTER COLUMN input_ratio TYPE NUMERIC(12,6),
  ALTER COLUMN output_ratio TYPE NUMERIC(12,6);

ALTER TABLE model_mappings RENAME COLUMN input_ratio TO input_price;
ALTER TABLE model_mappings RENAME COLUMN output_ratio TO output_price;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE model_mappings RENAME COLUMN input_price TO input_ratio;
ALTER TABLE model_mappings RENAME COLUMN output_price TO output_ratio;
ALTER TABLE model_mappings
  ALTER COLUMN input_ratio TYPE NUMERIC(8,4),
  ALTER COLUMN output_ratio TYPE NUMERIC(8,4);
-- +goose StatementEnd
