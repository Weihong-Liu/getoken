package billing

import (
	"testing"

	"github.com/shopspring/decimal"

	"github.com/puppet/getoken/server/internal/store"
)

func mustDec(s string) decimal.Decimal {
	d, err := decimal.NewFromString(s)
	if err != nil {
		panic(err)
	}
	return d
}

// GPT-4o 默认价：input 2.5 / output 10（USD per 1M tokens），group ratio = 1.0
// 1000 input + 500 output = (1000*2.5 + 500*10) / 1_000_000 = 7500/1e6 = 0.0075
func TestCostUSD_GPT4oBasic(t *testing.T) {
	m := &store.ModelMapping{
		InputPrice:  mustDec("2.5"),
		OutputPrice: mustDec("10"),
	}
	g := &store.Group{Ratio: decimal.NewFromInt(1)}
	got := CostUSD(m, g, 1000, 500)
	want := mustDec("0.0075")
	if !got.Equal(want) {
		t.Fatalf("CostUSD = %s, want %s", got, want)
	}
}

// 校验 group ratio 生效
func TestCostUSD_WithGroupRatio(t *testing.T) {
	m := &store.ModelMapping{
		InputPrice:  mustDec("2.5"),
		OutputPrice: mustDec("10"),
	}
	g := &store.Group{Ratio: mustDec("0.5")}
	got := CostUSD(m, g, 1000, 500)
	want := mustDec("0.00375")
	if !got.Equal(want) {
		t.Fatalf("CostUSD = %s, want %s", got, want)
	}
}

// claude-3-5-sonnet：input 3 / output 15 / cached 0.3 / cacheCreation 3.75
// 1000 input + 500 output + 200 cached + 100 cache_creation
// = (1000*3 + 500*15 + 200*0.3 + 100*3.75) / 1e6
// = (3000 + 7500 + 60 + 375) / 1e6 = 10935 / 1e6 = 0.010935
func TestCostUSDDetailed_Claude(t *testing.T) {
	m := &store.ModelMapping{
		InputPrice:         mustDec("3"),
		OutputPrice:        mustDec("15"),
		CachedPrice:        mustDec("0.3"),
		CacheCreationPrice: mustDec("3.75"),
	}
	g := &store.Group{Ratio: decimal.NewFromInt(1)}
	got := CostUSDDetailed(m, g, Tokens{Input: 1000, Output: 500, CachedInput: 200, CacheCreation: 100})
	want := mustDec("0.010935")
	if !got.Equal(want) {
		t.Fatalf("CostUSDDetailed = %s, want %s", got, want)
	}
}

// cached/cacheCreation price 为 0 时回落到 inputPrice
func TestCostUSDDetailed_CacheFallback(t *testing.T) {
	m := &store.ModelMapping{
		InputPrice:  mustDec("2"),
		OutputPrice: mustDec("8"),
	}
	g := &store.Group{Ratio: decimal.NewFromInt(1)}
	got := CostUSDDetailed(m, g, Tokens{Input: 0, Output: 0, CachedInput: 1_000_000, CacheCreation: 0})
	want := mustDec("2")
	if !got.Equal(want) {
		t.Fatalf("CostUSDDetailed fallback = %s, want %s", got, want)
	}
}

func TestCostUSD_NilModel(t *testing.T) {
	if !CostUSD(nil, nil, 100, 100).Equal(decimal.Zero) {
		t.Fatal("CostUSD(nil) should be 0")
	}
}
