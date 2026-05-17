package auth

import (
	"regexp"
	"strings"
)

// Email-suffix whitelist for registration.
//
// Suffixes are stored in canonical "@domain" form (lowercase, trimmed).
// Empty whitelist means "allow any domain" — same convention as the frontend
// admin settings page.

var emailDomainPattern = regexp.MustCompile(
	`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$`,
)

// emailSuffix extracts the normalized "@domain" suffix from an email.
// Returns "" if the input has no usable domain.
func emailSuffix(email string) string {
	email = strings.ToLower(strings.TrimSpace(email))
	at := strings.LastIndexByte(email, '@')
	if at <= 0 || at == len(email)-1 {
		return ""
	}
	domain := email[at+1:]
	if strings.ContainsRune(domain, '@') {
		return ""
	}
	return "@" + domain
}

// isEmailSuffixAllowed reports whether the email's domain is permitted by the
// whitelist. An empty whitelist permits every domain.
func isEmailSuffixAllowed(email string, whitelist []string) bool {
	if len(whitelist) == 0 {
		return true
	}
	suffix := emailSuffix(email)
	if suffix == "" {
		return false
	}
	for _, allowed := range whitelist {
		if suffix == allowed {
			return true
		}
	}
	return false
}

// normalizeEmailSuffix lowercases, trims, and validates one suffix. The input
// may be either "@domain" or bare "domain"; both yield "@domain" on success.
// Invalid inputs return "".
func normalizeEmailSuffix(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return ""
	}
	domain := v
	if strings.HasPrefix(domain, "@") {
		domain = domain[1:]
	}
	if domain == "" || strings.ContainsRune(domain, '@') {
		return ""
	}
	if !emailDomainPattern.MatchString(domain) {
		return ""
	}
	return "@" + domain
}

// normalizeEmailSuffixWhitelist dedupes and normalizes a list of suffixes.
// Invalid entries are dropped silently so a misconfigured saved value can't
// brick registration.
func normalizeEmailSuffixWhitelist(raw []string) []string {
	seen := make(map[string]struct{}, len(raw))
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		n := normalizeEmailSuffix(item)
		if n == "" {
			continue
		}
		if _, dup := seen[n]; dup {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out
}
