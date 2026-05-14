package idgen

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

// RandomHex returns n bytes encoded as 2n hex characters.
func RandomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// RandomAlpha returns an upper-case alphanumeric string of length n (no 0/1/I/L/O).
func RandomAlpha(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	out := make([]byte, n)
	for i, x := range b {
		out[i] = alphabet[int(x)%len(alphabet)]
	}
	return string(out)
}

// RedemptionCode returns codes like GT-XXXX-XXXX-XXXX.
func RedemptionCode() string {
	return "GT-" + RandomAlpha(4) + "-" + RandomAlpha(4) + "-" + RandomAlpha(4)
}

// APIKey returns sk-getoken-<32 hex> tokens used by the user-facing API.
func APIKey() string {
	return "sk-getoken-" + RandomHex(16)
}

// MaskKey returns the first 14 chars (e.g. sk-getoken-abcd) followed by suffix.
func MaskKey(key string) (prefix string) {
	if len(key) <= 18 {
		return key
	}
	return key[:14] + "..." + key[len(key)-4:]
}

// CodeFromEmail returns a 6-digit string suitable for email verification codes.
func CodeFromEmail() string {
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	var sb strings.Builder
	for _, x := range b {
		sb.WriteByte('0' + (x % 10))
		sb.WriteByte('0' + ((x >> 4) % 10))
	}
	return sb.String()
}
