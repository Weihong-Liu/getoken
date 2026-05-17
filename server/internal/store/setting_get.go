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

// SettingBool reads a setting value as a bool. Accepts JSON true/false or the
// strings "true"/"false"/"1"/"0". Returns def on any miss / parse failure.
func SettingBool(db *gorm.DB, key string, def bool) bool {
	var rows []Setting
	if err := db.Where("key = ?", key).Limit(1).Find(&rows).Error; err != nil {
		return def
	}
	if len(rows) == 0 {
		return def
	}
	var v any
	if err := json.Unmarshal([]byte(rows[0].Value), &v); err != nil {
		return def
	}
	switch x := v.(type) {
	case bool:
		return x
	case string:
		switch x {
		case "true", "1":
			return true
		case "false", "0":
			return false
		}
	case float64:
		return x != 0
	}
	return def
}

// SettingStringSlice reads a setting value as a slice of strings. Accepts a JSON
// array or a single string (returned as a one-element slice). Returns def on
// miss / parse failure. Empty slices are returned as-is so callers can
// distinguish "explicitly empty" from "missing" by comparing to def.
func SettingStringSlice(db *gorm.DB, key string, def []string) []string {
	var rows []Setting
	if err := db.Where("key = ?", key).Limit(1).Find(&rows).Error; err != nil {
		return def
	}
	if len(rows) == 0 {
		return def
	}
	var v any
	if err := json.Unmarshal([]byte(rows[0].Value), &v); err != nil {
		return def
	}
	switch x := v.(type) {
	case []any:
		out := make([]string, 0, len(x))
		for _, item := range x {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	case string:
		if x == "" {
			return []string{}
		}
		return []string{x}
	}
	return def
}
