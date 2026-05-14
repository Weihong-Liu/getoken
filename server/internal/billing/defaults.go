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

// DefaultModels 是一份内置主流模型快照，价格参考各厂商 2025 年公开报价（USD per 1M tokens）。
// 数值不必时刻追平最新版本——管理员可在前端二次调整。
var DefaultModels = []DefaultModel{
	// ----------------- OpenAI -----------------
	{ModelID: "gpt-4o", Vendor: "OpenAI", InputPrice: "2.5", OutputPrice: "10", CachedPrice: "1.25", Context: 128000},
	{ModelID: "gpt-4o-2024-08-06", Vendor: "OpenAI", InputPrice: "2.5", OutputPrice: "10", CachedPrice: "1.25", Context: 128000},
	{ModelID: "gpt-4o-mini", Vendor: "OpenAI", InputPrice: "0.15", OutputPrice: "0.6", CachedPrice: "0.075", Context: 128000},
	{ModelID: "gpt-4-turbo", Vendor: "OpenAI", InputPrice: "10", OutputPrice: "30", Context: 128000},
	{ModelID: "gpt-4", Vendor: "OpenAI", InputPrice: "30", OutputPrice: "60", Context: 8192},
	{ModelID: "gpt-3.5-turbo", Vendor: "OpenAI", InputPrice: "0.5", OutputPrice: "1.5", Context: 16385},
	{ModelID: "o1-preview", Vendor: "OpenAI", InputPrice: "15", OutputPrice: "60", CachedPrice: "7.5", Context: 128000},
	{ModelID: "o1-mini", Vendor: "OpenAI", InputPrice: "1.1", OutputPrice: "4.4", CachedPrice: "0.55", Context: 128000},
	{ModelID: "o3", Vendor: "OpenAI", InputPrice: "10", OutputPrice: "40", CachedPrice: "2.5", Context: 200000},
	{ModelID: "o3-mini", Vendor: "OpenAI", InputPrice: "1.1", OutputPrice: "4.4", CachedPrice: "0.55", Context: 200000},
	{ModelID: "gpt-5", Vendor: "OpenAI", InputPrice: "1.25", OutputPrice: "10", CachedPrice: "0.125", Context: 400000},
	{ModelID: "gpt-5-mini", Vendor: "OpenAI", InputPrice: "0.25", OutputPrice: "2", CachedPrice: "0.025", Context: 400000},
	{ModelID: "text-embedding-3-small", Vendor: "OpenAI", InputPrice: "0.02", OutputPrice: "0", Context: 8191},
	{ModelID: "text-embedding-3-large", Vendor: "OpenAI", InputPrice: "0.13", OutputPrice: "0", Context: 8191},

	// ----------------- Anthropic -----------------
	{ModelID: "claude-3-5-sonnet-latest", Vendor: "Anthropic", InputPrice: "3", OutputPrice: "15", CachedPrice: "0.3", CacheCreationPrice: "3.75", Context: 200000},
	{ModelID: "claude-3-5-haiku-latest", Vendor: "Anthropic", InputPrice: "0.8", OutputPrice: "4", CachedPrice: "0.08", CacheCreationPrice: "1", Context: 200000},
	{ModelID: "claude-3-opus", Vendor: "Anthropic", InputPrice: "15", OutputPrice: "75", CachedPrice: "1.5", CacheCreationPrice: "18.75", Context: 200000},
	{ModelID: "claude-sonnet-4", Vendor: "Anthropic", InputPrice: "3", OutputPrice: "15", CachedPrice: "0.3", CacheCreationPrice: "3.75", Context: 200000},
	{ModelID: "claude-opus-4", Vendor: "Anthropic", InputPrice: "15", OutputPrice: "75", CachedPrice: "1.5", CacheCreationPrice: "18.75", Context: 200000},
	{ModelID: "claude-haiku-4-5", Vendor: "Anthropic", InputPrice: "1", OutputPrice: "5", CachedPrice: "0.1", CacheCreationPrice: "1.25", Context: 200000},

	// ----------------- Google -----------------
	{ModelID: "gemini-2.5-pro", Vendor: "Google", InputPrice: "1.25", OutputPrice: "5", CachedPrice: "0.3125", Context: 1048576},
	{ModelID: "gemini-2.5-flash", Vendor: "Google", InputPrice: "0.075", OutputPrice: "0.3", CachedPrice: "0.01875", Context: 1048576},
	{ModelID: "gemini-1.5-pro", Vendor: "Google", InputPrice: "1.25", OutputPrice: "5", CachedPrice: "0.3125", Context: 2097152},
	{ModelID: "gemini-1.5-flash", Vendor: "Google", InputPrice: "0.075", OutputPrice: "0.3", CachedPrice: "0.01875", Context: 1048576},

	// ----------------- DeepSeek -----------------
	{ModelID: "deepseek-chat", Vendor: "DeepSeek", InputPrice: "0.27", OutputPrice: "1.10", CachedPrice: "0.07", Context: 65536},
	{ModelID: "deepseek-reasoner", Vendor: "DeepSeek", InputPrice: "0.55", OutputPrice: "2.19", CachedPrice: "0.14", Context: 65536},

	// ----------------- Moonshot -----------------
	{ModelID: "kimi-k2", Vendor: "Moonshot", InputPrice: "1", OutputPrice: "3", Context: 131072},

	// ----------------- Alibaba (Qwen) -----------------
	{ModelID: "qwen3-max", Vendor: "Alibaba", InputPrice: "5", OutputPrice: "20", Context: 131072},
	{ModelID: "qwen-plus", Vendor: "Alibaba", InputPrice: "0.8", OutputPrice: "2", Context: 131072},

	// ----------------- xAI -----------------
	{ModelID: "grok-3", Vendor: "xAI", InputPrice: "3", OutputPrice: "15", Context: 131072},
	{ModelID: "grok-3-mini", Vendor: "xAI", InputPrice: "0.3", OutputPrice: "0.5", Context: 131072},
}
