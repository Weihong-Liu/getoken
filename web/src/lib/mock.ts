// Demo data fallbacks so the UI renders before the backend is wired up.
import type { DashboardStats, LogEntry, Token } from "@/lib/api";

export const demoStats: DashboardStats = {
  balance: 86.42,
  usedToday: 4.17,
  requestsToday: 1238,
  series: Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return {
      date: d.toISOString().slice(5, 10),
      requests: Math.floor(800 + Math.random() * 1500),
      tokens: Math.floor(120_000 + Math.random() * 320_000),
      cost: Number((1 + Math.random() * 6).toFixed(2)),
    };
  }),
  topModels: [
    { name: "claude-sonnet-4-6", requests: 5210, tokens: 1_820_000 },
    { name: "gpt-4o", requests: 3420, tokens: 1_140_000 },
    { name: "gemini-2.5-pro", requests: 1280, tokens: 540_000 },
    { name: "deepseek-v3", requests: 980, tokens: 380_000 },
    { name: "claude-opus-4-7", requests: 410, tokens: 210_000 },
  ],
};

export const demoTokens: Token[] = [
  {
    id: 1,
    name: "默认密钥",
    key: "sk-getoken-abcdefghijklmnopqrstuvwxyz123456",
    status: 1,
    remainQuota: 4200,
    unlimitedQuota: false,
    expiredAt: null,
    keyPrefix: "sk-getoken-ab",
    groupId: 1,
    ipWhitelist: "",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: 2,
    name: "线上服务",
    key: "sk-getoken-zyxwvutsrqponmlkjihgfedcba987654",
    status: 1,
    remainQuota: 12000,
    unlimitedQuota: false,
    expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    keyPrefix: "sk-getoken-zy",
    groupId: 1,
    ipWhitelist: "1.2.3.4\n5.6.7.0/24",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: 3,
    name: "测试 key (已禁)",
    key: "sk-getoken-test1234567890abcdef1234567890",
    status: 0,
    remainQuota: 0,
    unlimitedQuota: false,
    expiredAt: null,
    keyPrefix: "sk-getoken-ab",
    groupId: 1,
    ipWhitelist: "",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
];

export const demoLogs: LogEntry[] = Array.from({ length: 32 }, (_, i) => {
  const models = ["claude-sonnet-4-6", "gpt-4o", "deepseek-v3", "gemini-2.5-pro", "qwen3-max"];
  const status = Math.random() > 0.92 ? "error" : "success";
  return {
    id: 1000 - i,
    createdAt: new Date(Date.now() - i * 1000 * 60 * Math.floor(2 + Math.random() * 30)).toISOString(),
    type: "request",
    modelName: models[i % models.length],
    tokenName: i % 3 === 0 ? "线上服务" : "默认密钥",
    promptTokens: Math.floor(200 + Math.random() * 4000),
    completionTokens: Math.floor(80 + Math.random() * 1200),
    cachedTokens: 0,
    cacheCreationTokens: 0,
    reasoningEffort: "",
    reasoningTokens: 0,
    quota: Number((Math.random() * 0.4).toFixed(4)),
    status,
    latencyMs: Math.floor(200 + Math.random() * 1800),
    error: status === "error" ? "upstream: connection reset" : undefined,
  };
});
