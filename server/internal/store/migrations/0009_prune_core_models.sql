-- +goose Up
-- +goose StatementBegin
DELETE FROM model_mappings
WHERE lower(model_id) NOT LIKE 'claude%'
  AND lower(model_id) NOT LIKE 'gpt%'
  AND lower(model_id) NOT LIKE 'gemini%';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Intentionally empty: deleted model mappings cannot be reconstructed safely.
SELECT 1;
-- +goose StatementEnd
