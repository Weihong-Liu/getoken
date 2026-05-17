package topup

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/url"
	"strings"
	"testing"
)

func TestAlipaySignAndVerifyNotify(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	privatePEM := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}))
	publicDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	publicPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER}))

	params := map[string]string{
		"app_id":       "2021000000000000",
		"out_trade_no": "pay_test_001",
		"trade_status": "TRADE_SUCCESS",
		"total_amount": "12.30",
	}
	sign, err := signAlipayParams(params, privatePEM)
	if err != nil {
		t.Fatal(err)
	}

	values := url.Values{}
	for k, v := range params {
		values.Set(k, v)
	}
	values.Set("sign_type", "RSA2")
	values.Set("sign", sign)
	if !verifyAlipayNotify(values, publicPEM) {
		t.Fatal("expected notify signature to verify")
	}

	values.Set("total_amount", "12.31")
	if verifyAlipayNotify(values, publicPEM) {
		t.Fatal("tampered notify should not verify")
	}
}

func TestParseRawBase64Keys(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	rawPrivate := base64.StdEncoding.EncodeToString(x509.MarshalPKCS1PrivateKey(key))
	if _, err := parseRSAPrivateKey(rawPrivate); err != nil {
		t.Fatalf("parse raw private key: %v", err)
	}
	rawPublic := base64.StdEncoding.EncodeToString(x509.MarshalPKCS1PublicKey(&key.PublicKey))
	if _, err := parseRSAPublicKey(strings.Join([]string{rawPublic[:64], rawPublic[64:]}, "\n")); err != nil {
		t.Fatalf("parse raw public key: %v", err)
	}
}
