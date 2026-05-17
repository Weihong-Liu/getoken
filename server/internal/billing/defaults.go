package billing

// DefaultModel 描述一条内置模型快照。
// 所有价格单位均为 USD per 1M tokens；CachedPrice / CacheCreationPrice 为空串时
// 调用方按 InputPrice 兜底（与 CostUSDDetailed 的回落语义一致）。
type DefaultModel struct {
	ModelID            string
	Vendor             string
	InputPrice         string
	OutputPrice        string
	CachedPrice        string
	CacheCreationPrice string
	Context            int
}

// DefaultModels 是一份内置核心模型快照，仅保留 Claude / GPT / Gemini 三条产品线。
// 数值不必时刻追平最新版本——管理员可在前端二次调整。
var DefaultModels = []DefaultModel{
	// ----------------- OpenAI -----------------
	{ModelID: "gpt-5", Vendor: "OpenAI", InputPrice: "1.25", OutputPrice: "10", CachedPrice: "0.125", Context: 400000},
	{ModelID: "gpt-5-mini", Vendor: "OpenAI", InputPrice: "0.25", OutputPrice: "2", CachedPrice: "0.025", Context: 400000},
	{ModelID: "gpt-4o", Vendor: "OpenAI", InputPrice: "2.5", OutputPrice: "10", CachedPrice: "1.25", Context: 128000},
	{ModelID: "gpt-4o-2024-08-06", Vendor: "OpenAI", InputPrice: "2.5", OutputPrice: "10", CachedPrice: "1.25", Context: 128000},
	{ModelID: "gpt-4o-mini", Vendor: "OpenAI", InputPrice: "0.15", OutputPrice: "0.6", CachedPrice: "0.075", Context: 128000},
	{ModelID: "gpt-4-turbo", Vendor: "OpenAI", InputPrice: "10", OutputPrice: "30", Context: 128000},
	{ModelID: "gpt-4", Vendor: "OpenAI", InputPrice: "30", OutputPrice: "60", Context: 8192},
	{ModelID: "gpt-3.5-turbo", Vendor: "OpenAI", InputPrice: "0.5", OutputPrice: "1.5", Context: 16385},

	// ----------------- Anthropic -----------------
	{ModelID: "claude-sonnet-4-6", Vendor: "Anthropic", InputPrice: "3", OutputPrice: "15", CachedPrice: "0.3", CacheCreationPrice: "3.75", Context: 200000},
	{ModelID: "claude-opus-4-7", Vendor: "Anthropic", InputPrice: "15", OutputPrice: "75", CachedPrice: "1.5", CacheCreationPrice: "18.75", Context: 200000},
	{ModelID: "claude-haiku-4-5", Vendor: "Anthropic", InputPrice: "1", OutputPrice: "5", CachedPrice: "0.1", CacheCreationPrice: "1.25", Context: 200000},
	{ModelID: "claude-3-5-sonnet-latest", Vendor: "Anthropic", InputPrice: "3", OutputPrice: "15", CachedPrice: "0.3", CacheCreationPrice: "3.75", Context: 200000},
	{ModelID: "claude-3-5-haiku-latest", Vendor: "Anthropic", InputPrice: "0.8", OutputPrice: "4", CachedPrice: "0.08", CacheCreationPrice: "1", Context: 200000},

	// ----------------- Google -----------------
	{ModelID: "gemini-2.5-pro", Vendor: "Google", InputPrice: "1.25", OutputPrice: "5", CachedPrice: "0.3125", Context: 1048576},
	{ModelID: "gemini-2.5-flash", Vendor: "Google", InputPrice: "0.075", OutputPrice: "0.3", CachedPrice: "0.01875", Context: 1048576},
	{ModelID: "gemini-2.0-flash", Vendor: "Google", InputPrice: "0.10", OutputPrice: "0.4", CachedPrice: "0.025", Context: 1048576},
	{ModelID: "gemini-1.5-pro", Vendor: "Google", InputPrice: "1.25", OutputPrice: "5", CachedPrice: "0.3125", Context: 2097152},
	{ModelID: "gemini-1.5-flash", Vendor: "Google", InputPrice: "0.075", OutputPrice: "0.3", CachedPrice: "0.01875", Context: 1048576},
}
