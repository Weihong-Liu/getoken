export type AdminUser = {
  id: number;
  email: string;
  role: "user" | "admin";
  group: string;
  balance: number;
  used: number;
  status: "active" | "banned";
  createdAt: string;
};

export type AdminChannel = {
  id: number;
  name: string;
  type: string;
  status: "online" | "degraded" | "offline";
  models: string[];
  keys: number;
  priority: number;
  weight: number;
  latencyMs: number;
};

export type AdminModel = {
  id: string;
  vendor: string;
  channels: number;
  inputRatio: number;
  outputRatio: number;
  status: "online" | "offline";
  groups: string[];
};

export type AdminGroup = {
  id: number;
  name: string;
  ratio: number;
  users: number;
  channels: number;
};

export type RedemptionCode = {
  id: number;
  code: string;
  amount: number;
  status: "unused" | "used";
  usedBy?: string;
  usedAt?: string;
  createdAt: string;
};

export type Order = {
  id: string;
  user: string;
  amount: number;
  channel: string;
  status: "paid" | "pending" | "cancelled";
  createdAt: string;
};

export type Announcement = {
  id: number;
  title: string;
  level: "info" | "warning" | "danger";
  status: "published" | "draft";
  createdAt: string;
};

export const demoAdminUsers: AdminUser[] = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  email: `user${i + 1}@example.com`,
  role: i === 0 ? "admin" : "user",
  group: i % 4 === 0 ? "vip" : "default",
  balance: Number((Math.random() * 500).toFixed(2)),
  used: Number((Math.random() * 1500).toFixed(2)),
  status: i === 13 ? "banned" : "active",
  createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
}));

export const demoAdminChannels: AdminChannel[] = [
  { id: 1, name: "Anthropic 官方", type: "anthropic", status: "online", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"], keys: 8, priority: 10, weight: 10, latencyMs: 320 },
  { id: 2, name: "OpenAI 官方", type: "openai", status: "online", models: ["gpt-5", "gpt-4o", "o1-pro"], keys: 12, priority: 10, weight: 10, latencyMs: 280 },
  { id: 3, name: "Azure OpenAI 香港", type: "azure", status: "online", models: ["gpt-4o", "gpt-5"], keys: 4, priority: 5, weight: 5, latencyMs: 240 },
  { id: 4, name: "Google Gemini", type: "gemini", status: "degraded", models: ["gemini-2.5-pro", "gemini-2.5-flash"], keys: 6, priority: 8, weight: 8, latencyMs: 820 },
  { id: 5, name: "DeepSeek 官方", type: "deepseek", status: "online", models: ["deepseek-v3", "deepseek-r1"], keys: 3, priority: 7, weight: 7, latencyMs: 195 },
  { id: 6, name: "Kimi (Moonshot)", type: "moonshot", status: "online", models: ["kimi-k2"], keys: 2, priority: 5, weight: 5, latencyMs: 220 },
  { id: 7, name: "硅基流动", type: "siliconflow", status: "online", models: ["deepseek-v3", "qwen3-max"], keys: 5, priority: 3, weight: 3, latencyMs: 350 },
  { id: 8, name: "测试备份渠道", type: "openai", status: "offline", models: ["gpt-4o"], keys: 1, priority: 1, weight: 1, latencyMs: 0 },
];

export const demoAdminModels: AdminModel[] = [
  { id: "claude-sonnet-4-6", vendor: "Anthropic", channels: 1, inputRatio: 1.0, outputRatio: 1.0, status: "online", groups: ["default", "vip"] },
  { id: "claude-opus-4-7", vendor: "Anthropic", channels: 1, inputRatio: 1.0, outputRatio: 1.0, status: "online", groups: ["vip"] },
  { id: "gpt-5", vendor: "OpenAI", channels: 2, inputRatio: 1.0, outputRatio: 1.0, status: "online", groups: ["default", "vip"] },
  { id: "gpt-4o", vendor: "OpenAI", channels: 3, inputRatio: 0.8, outputRatio: 0.8, status: "online", groups: ["default", "vip"] },
  { id: "gemini-2.5-pro", vendor: "Google", channels: 1, inputRatio: 1.0, outputRatio: 1.0, status: "online", groups: ["default", "vip"] },
  { id: "deepseek-v3", vendor: "DeepSeek", channels: 2, inputRatio: 0.5, outputRatio: 0.5, status: "online", groups: ["default", "vip"] },
];

export const demoAdminGroups: AdminGroup[] = [
  { id: 1, name: "default", ratio: 1.0, users: 124, channels: 6 },
  { id: 2, name: "vip", ratio: 0.8, users: 12, channels: 8 },
  { id: 3, name: "internal", ratio: 0.1, users: 3, channels: 8 },
];

export const demoRedemptionCodes: RedemptionCode[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  code: `GT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  amount: [10, 30, 50, 100, 300][i % 5],
  status: i < 3 ? "used" : "unused",
  usedBy: i < 3 ? `user${i + 1}@example.com` : undefined,
  usedAt: i < 3 ? new Date(Date.now() - i * 86400000).toISOString() : undefined,
  createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
}));

export const demoOrders: Order[] = Array.from({ length: 12 }, (_, i) => ({
  id: `ORD${Date.now() - i * 1000000}`.slice(0, 12),
  user: `user${(i % 8) + 1}@example.com`,
  amount: [10, 30, 50, 100, 300, 500][i % 6],
  channel: ["alipay", "wxpay", "usdt"][i % 3],
  status: i < 9 ? "paid" : i < 11 ? "pending" : "cancelled",
  createdAt: new Date(Date.now() - i * 3600000).toISOString(),
}));

export const demoAnnouncements: Announcement[] = [
  { id: 1, title: "Claude Sonnet 4.6 已上线,价格下调 20%", level: "info", status: "published", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 2, title: "维护通知:2026-05-15 凌晨 2:00 进行 30 分钟维护", level: "warning", status: "published", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 3, title: "GPT-5 上游临时不稳定,正在切换备用渠道", level: "danger", status: "draft", createdAt: new Date(Date.now() - 86400000).toISOString() },
];
