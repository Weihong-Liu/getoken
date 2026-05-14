package store

import (
	"encoding/json"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// SettingDecimal reads a setting value as a decimal.Decimal. Accepts numeric or
// string-encoded JSON values; returns def on any miss / parse failure.
// Uses Find (not First) so a missing key doesn't trigger GORM's not-found warn log.
func SettingDecimal(db *gorm.DB, key string, def decimal.Decimal) decimal.Decimal {
	var rows []Setting
	if err := db.Where("key = ?", key).Limit(1).Find(&rows).Error; err != nil {
		return def
	}
	if len(rows) == 0 {
		return def
	}
	s := rows[0]
	var v any
	if err := json.Unmarshal([]byte(s.Value), &v); err != nil {
		return def
	}
	switch x := v.(type) {
	case float64:
		return decimal.NewFromFloat(x)
	case string:
		if d, err := decimal.NewFromString(x); err == nil {
			return d
		}
	}
	return def
}
