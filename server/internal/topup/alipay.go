package topup

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/puppet/getoken/server/internal/store"
)

const defaultAlipayGateway = "https://openapi.alipay.com/gateway.do"

type alipayConfig struct {
	Enabled    bool
	AppID      string
	PrivateKey string
	PublicKey  string
	Gateway    string
	NotifyURL  string
	ReturnURL  string
}

type alipayPagePayResp struct {
	PayURL string
}

func (h *Handler) loadAlipayConfig() alipayConfig {
	get := func(key string) string {
		var setting store.Setting
		if err := h.s.DB.Where("key = ?", key).First(&setting).Error; err != nil {
			return ""
		}
		return unquoteSetting(setting.Value)
	}
	cfg := alipayConfig{
		Enabled:    strings.EqualFold(get("payment.alipay.enabled"), "true"),
		AppID:      firstNonEmpty(get("payment.alipay.appId"), get("payment.alipay.account")),
		PrivateKey: firstNonEmpty(get("payment.alipay.privateKey"), get("payment.alipay.secret")),
		PublicKey:  get("payment.alipay.publicKey"),
		Gateway:    firstNonEmpty(get("payment.alipay.gateway"), defaultAlipayGateway),
		NotifyURL:  get("payment.alipay.notifyUrl"),
		ReturnURL:  get("payment.alipay.returnUrl"),
	}
	if h.cfg != nil && h.cfg.Env == "development" && cfg.Gateway == "" {
		cfg.Gateway = defaultAlipayGateway
	}
	return cfg
}

func (h *Handler) createAlipayPagePay(order store.PaymentOrder) (alipayPagePayResp, error) {
	cfg := h.loadAlipayConfig()
	if cfg.Gateway == "" {
		cfg.Gateway = defaultAlipayGateway
	}
	if cfg.AppID == "" || cfg.PrivateKey == "" {
		if h.cfg != nil && h.cfg.Env == "development" {
			return alipayPagePayResp{PayURL: fmt.Sprintf("/dashboard/topup?order=%s", order.OrderNo)}, nil
		}
		return alipayPagePayResp{}, fmt.Errorf("支付宝 App ID 或应用私钥未配置")
	}

	biz, err := json.Marshal(map[string]string{
		"out_trade_no": order.OrderNo,
		"product_code": "FAST_INSTANT_TRADE_PAY",
		"total_amount": order.Amount.StringFixed(2),
		"subject":      "GeToken 余额充值",
		"body":         "GeToken account balance topup",
	})
	if err != nil {
		return alipayPagePayResp{}, err
	}
	params := map[string]string{
		"app_id":      cfg.AppID,
		"method":      "alipay.trade.page.pay",
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   time.Now().Format("2006-01-02 15:04:05"),
		"version":     "1.0",
		"biz_content": string(biz),
	}
	if cfg.NotifyURL != "" {
		params["notify_url"] = cfg.NotifyURL
	}
	if cfg.ReturnURL != "" {
		params["return_url"] = cfg.ReturnURL
	}
	sign, err := signAlipayParams(params, cfg.PrivateKey)
	if err != nil {
		return alipayPagePayResp{}, err
	}
	params["sign"] = sign
	values := url.Values{}
	for k, v := range params {
		if strings.TrimSpace(v) != "" {
			values.Set(k, v)
		}
	}
	return alipayPagePayResp{PayURL: strings.TrimRight(cfg.Gateway, "?") + "?" + values.Encode()}, nil
}

func verifyAlipayNotify(values url.Values, publicKey string) bool {
	signature := values.Get("sign")
	if signature == "" || publicKey == "" {
		return false
	}
	params := map[string]string{}
	for k, vs := range values {
		if k == "sign" || k == "sign_type" || len(vs) == 0 {
			continue
		}
		if strings.TrimSpace(vs[0]) == "" {
			continue
		}
		params[k] = vs[0]
	}
	payload := alipaySignContent(params)
	pub, err := parseRSAPublicKey(publicKey)
	if err != nil {
		return false
	}
	rawSig, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return false
	}
	hash := sha256.Sum256([]byte(payload))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], rawSig) == nil
}

func signAlipayParams(params map[string]string, privateKey string) (string, error) {
	key, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	payload := alipaySignContent(params)
	hash := sha256.Sum256([]byte(payload))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

func alipaySignContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "sign" || strings.TrimSpace(v) == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	return strings.Join(parts, "&")
}

func parseRSAPrivateKey(raw string) (*rsa.PrivateKey, error) {
	block, err := pemOrRawBlock(raw, "PRIVATE KEY")
	if err != nil {
		return nil, err
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}
	return key, nil
}

func parseRSAPublicKey(raw string) (*rsa.PublicKey, error) {
	block, err := pemOrRawBlock(raw, "PUBLIC KEY")
	if err != nil {
		return nil, err
	}
	if pubAny, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if pub, ok := pubAny.(*rsa.PublicKey); ok {
			return pub, nil
		}
	}
	if pub, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return pub, nil
	}
	return nil, fmt.Errorf("public key is not RSA")
}

func pemOrRawBlock(raw, typ string) (*pem.Block, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("empty key")
	}
	if block, _ := pem.Decode([]byte(raw)); block != nil {
		return block, nil
	}
	compact := strings.NewReplacer("\n", "", "\r", "", " ", "").Replace(raw)
	der, err := base64.StdEncoding.DecodeString(compact)
	if err != nil {
		return nil, err
	}
	return &pem.Block{Type: typ, Bytes: der}, nil
}

func unquoteSetting(raw string) string {
	var s string
	if err := json.Unmarshal([]byte(raw), &s); err == nil {
		return s
	}
	var b bool
	if err := json.Unmarshal([]byte(raw), &b); err == nil {
		if b {
			return "true"
		}
		return "false"
	}
	return strings.Trim(raw, `"`)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func decimalEqualsMoney(a decimal.Decimal, raw string) bool {
	b, err := decimal.NewFromString(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	return a.Round(2).Equal(b.Round(2))
}
