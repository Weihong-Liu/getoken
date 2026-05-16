// Demo data fallbacks so the UI renders before the backend is wired up.
import type {
  AdminAnnouncement,
  AdminGroup,
  AdminModelMapping,
  AdminRedemption,
  AdminSettings,
  AdminStats,
  AdminUpstream,
  AdminUser,
  AuditLog,
  DashboardStats,
  LogEntry,
  Referrals,
  Token,
} from "@/lib/api";

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

export const demoReferrals: Referrals = {
  inviteCode: "GT-ADMIN",
  stats: { invitees: 8, totalReward: 36.82, monthInvitees: 3 },
  items: Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    email: `friend${i + 1}@example.com`,
    joinedAt: new Date(Date.now() - i * 86400000 * 4).toISOString(),
    totalSpend: Number((24 + i * 18.6).toFixed(2)),
    reward: Number((1.2 + i * 0.92).toFixed(2)),
  })),
};

export const demoAdminStats: AdminStats = {
  users: 126,
  tokens: 318,
  requestsToday: 48200,
  revenueToday: 386.72,
  series: demoStats.series.map((item) => ({
    ...item,
    requests: item.requests * 8,
    tokens: item.tokens * 9,
    cost: Number((item.cost * 14).toFixed(2)),
  })),
  topModels: demoStats.topModels.map((item) => ({
    ...item,
    requests: item.requests * 5,
    tokens: item.tokens * 6,
  })),
};

export const demoAdminUsers: AdminUser[] = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  email: i === 0 ? "admin@getoken.dev" : `user${i + 1}@example.com`,
  username: i === 0 ? "admin" : `user${i + 1}`,
  role: i === 0 ? "admin" : "user",
  status: i === 13 ? "banned" : "active",
  groupId: i % 4 === 0 ? 2 : 1,
  quota: Number((80 + Math.random() * 500).toFixed(2)),
  usedQuota: Number((20 + Math.random() * 1200).toFixed(2)),
  inviteCode: `GT-${String(i + 1).padStart(4, "0")}`,
  createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
}));

export const demoAdminUpstreams: AdminUpstream[] = [
  {
    id: 1,
    name: "Anthropic 官方",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com",
    status: "online",
    priority: 10,
    weight: 10,
    latencyMs: 280,
    lastCheckAt: new Date(Date.now() - 90_000).toISOString(),
    note: "主通道",
    apiKeyMask: "sk-ant-***-main",
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 90_000).toISOString(),
  },
  {
    id: 2,
    name: "OpenAI 官方",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    status: "online",
    priority: 10,
    weight: 10,
    latencyMs: 245,
    lastCheckAt: new Date(Date.now() - 80_000).toISOString(),
    note: "主通道",
    apiKeyMask: "sk-proj-***-main",
    createdAt: new Date(Date.now() - 86400000 * 58).toISOString(),
    updatedAt: new Date(Date.now() - 80_000).toISOString(),
  },
  {
    id: 3,
    name: "Google Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    status: "degraded",
    priority: 8,
    weight: 6,
    latencyMs: 820,
    lastCheckAt: new Date(Date.now() - 130_000).toISOString(),
    note: "备用",
    apiKeyMask: "AIza***",
    createdAt: new Date(Date.now() - 86400000 * 42).toISOString(),
    updatedAt: new Date(Date.now() - 130_000).toISOString(),
  },
];

export const demoAdminModels: AdminModelMapping[] = [
  {
    id: 1,
    modelId: "claude-sonnet-4-6",
    vendor: "Anthropic",
    upstreamId: 1,
    upstreamModelName: "claude-sonnet-4-6",
    inputPrice: 3,
    outputPrice: 15,
    cachedPrice: 0.3,
    cacheCreationPrice: 3.75,
    context: 200000,
    status: "online",
    allowedGroups: "default,vip",
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 2,
    modelId: "gpt-5",
    vendor: "OpenAI",
    upstreamId: 2,
    upstreamModelName: "gpt-5",
    inputPrice: 5,
    outputPrice: 20,
    cachedPrice: 0.5,
    cacheCreationPrice: 6.25,
    context: 256000,
    status: "online",
    allowedGroups: "default,vip",
    createdAt: new Date(Date.now() - 86400000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 3,
    modelId: "gemini-2.5-pro",
    vendor: "Google",
    upstreamId: 3,
    upstreamModelName: "gemini-2.5-pro",
    inputPrice: 1.25,
    outputPrice: 10,
    cachedPrice: 0,
    cacheCreationPrice: 0,
    context: 1000000,
    status: "online",
    allowedGroups: "vip",
    createdAt: new Date(Date.now() - 86400000 * 16).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const demoAdminGroups: AdminGroup[] = [
  { id: 1, name: "default", ratio: 1, note: "默认用户分组", createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), updatedAt: new Date().toISOString() },
  { id: 2, name: "vip", ratio: 0.82, note: "高频用户折扣", createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), updatedAt: new Date().toISOString() },
  { id: 3, name: "internal", ratio: 0.1, note: "内部测试", createdAt: new Date(Date.now() - 86400000 * 32).toISOString(), updatedAt: new Date().toISOString() },
];

export const demoAdminRedemptions: AdminRedemption[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  code: `GT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  amount: [10, 30, 50, 100, 300, 500][i % 6],
  status: i < 4 ? "used" : "unused",
  batchId: `BATCH-${String(Math.floor(i / 4) + 1).padStart(3, "0")}`,
  usedBy: i < 4 ? i + 2 : null,
  usedAt: i < 4 ? new Date(Date.now() - i * 86400000).toISOString() : null,
  createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
}));

export const demoAdminAnnouncements: AdminAnnouncement[] = [
  {
    id: 1,
    title: "Claude Sonnet 4.6 已上线,价格下调 20%",
    content: "新模型已加入默认分组。",
    level: "info",
    status: "published",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 2,
    title: "维护通知:本周日凌晨 2:00 进行 30 分钟维护",
    content: "维护期间可能出现短暂切换。",
    level: "warning",
    status: "published",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

export const demoAdminAuditLogs: AuditLog[] = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  actorId: 1,
  targetUserId: i % 2 === 0 ? i + 2 : null,
  action: i % 3 === 0 ? "topup.redeem" : i % 3 === 1 ? "referral.reward" : "admin.model.seed",
  target: i % 3 === 2 ? "model" : "user",
  amount: i % 3 === 0 ? [10, 30, 50, 100][i % 4] : 0,
  detail: JSON.stringify({ source: "demo", index: i + 1 }),
  ip: `127.0.0.${i + 1}`,
  createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  actorEmail: "admin@getoken.dev",
  targetEmail: i % 2 === 0 ? `user${i + 2}@example.com` : undefined,
}));

export const demoAdminSettings: AdminSettings = {
  "site.title": "GeToken",
  "site.slogan": "一个入口接入多模型",
  "site.supportEmail": "support@getoken.dev",
  "smtp.host": "smtp.example.com",
  "smtp.port": 465,
  "smtp.tls": true,
  "payment.alipay.enabled": true,
  "payment.wxpay.enabled": true,
  "payment.usdt.enabled": false,
  "register.enabled": true,
  "register.requireEmail": true,
  "register.ipDailyLimit": 5,
  "invite.rewardPercent": 5,
  "invite.signupBonus": "1",
  "invite.refereeBonus": "2",
};
