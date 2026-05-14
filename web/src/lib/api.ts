export type UserRole = "user" | "admin";

export type User = {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  status: "active" | "banned";
  quota: number;
  usedQuota: number;
  groupId: number;
  inviteCode: string;
  createdAt: string;
};

export type Token = {
  id: number;
  name: string;
  // The plaintext key is only returned on creation. List endpoints expose `keyPrefix`.
  key?: string;
  keyPrefix: string;
  status: 1 | 0;
  remainQuota: number;
  unlimitedQuota: boolean;
  expiredAt: string | null;
  groupId: number;
  ipWhitelist: string;
  createdAt: string;
};

export type LogEntry = {
  id: number;
  createdAt: string;
  type: "request" | "topup" | "system";
  modelName: string;
  tokenName: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  reasoningEffort: string;       // "" | "low" | "medium" | "high" | "minimal" | "xhigh" | "max"
  reasoningTokens: number;       // 实际推理思考的 token 数（仅 OpenAI 系列返回）
  quota: number;
  status: "success" | "error";
  latencyMs: number;
  error?: string;
};

export type DashboardStats = {
  balance: number;
  usedToday: number;
  requestsToday: number;
  series: { date: string; requests: number; tokens: number; cost: number }[];
  topModels: { name: string; requests: number; tokens: number }[];
};

export type AdminStats = {
  users: number;
  tokens: number;
  requestsToday: number;
  revenueToday: number;
  series: { date: string; requests: number; tokens: number; cost: number }[];
  topModels: { name: string; requests: number; tokens: number }[];
};

export type ModelInfo = {
  id: string;
  vendor: string;
  context: number;
  inputPrice: number;
  outputPrice: number;
  status: "online" | "offline";
  group: string[];
};

export type StatusInfo = {
  channels: { name: string; status: "online" | "degraded" | "offline"; latency: number }[];
  uptime: number;
  updatedAt: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

// Convenience constants kept around so the LoginPage can pre-fill the bootstrap admin account
// that the backend auto-creates from ADMIN_EMAIL / ADMIN_PASSWORD env on first boot.
export const DEMO_LOGIN_EMAIL = "admin@getoken.dev";
export const DEMO_LOGIN_PASSWORD = "Getoken123!";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("getoken.session");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("getoken.session", token);
  else localStorage.removeItem("getoken.session");
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(API_BASE + path, { ...init, headers });
  const ct = res.headers.get("content-type") ?? "";
  const body: unknown = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof body === "object" && body && "message" in (body as Record<string, unknown>)
        ? String((body as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, body);
  }

  if (
    typeof body === "object" &&
    body &&
    "data" in (body as Record<string, unknown>)
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const fetcher = <T = unknown>(path: string) => apiFetch<T>(path);

// ---------------------------------------------------------------------------
// Admin / referral types
// ---------------------------------------------------------------------------

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type Referrals = {
  inviteCode: string;
  stats: { invitees: number; totalReward: number; monthInvitees: number };
  items: Array<{
    id: number;
    email: string;
    joinedAt: string;
    totalSpend: number;
    reward: number;
  }>;
};

export type AdminUser = {
  id: number;
  email: string;
  username: string;
  role: "user" | "admin";
  status: "active" | "banned";
  groupId: number;
  quota: number;
  usedQuota: number;
  inviteCode: string;
  createdAt: string;
};

export type AdminUpstream = {
  id: number;
  name: string;
  type: string;
  baseUrl: string;
  status: "online" | "degraded" | "offline";
  priority: number;
  weight: number;
  latencyMs: number;
  lastCheckAt: string | null;
  note: string;
  apiKeyMask: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminModelMapping = {
  id: number;
  modelId: string;
  vendor: string;
  upstreamId: number;
  upstreamModelName: string;
  inputPrice: number;  // USD per 1M input tokens
  outputPrice: number; // USD per 1M output tokens
  cachedPrice: number; // USD per 1M cache-hit tokens (0 = fall back to inputPrice)
  cacheCreationPrice: number; // USD per 1M cache-write tokens (0 = fall back to inputPrice)
  context: number;
  status: "online" | "offline";
  allowedGroups: string; // CSV "default,vip"
  createdAt: string;
  updatedAt: string;
};

export type AdminGroup = {
  id: number;
  name: string;
  ratio: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminRedemption = {
  id: number;
  code: string;
  amount: number;
  status: "unused" | "used";
  batchId: string;
  usedBy: number | null;
  usedAt: string | null;
  createdAt: string;
};

export type AdminRedemptionBatch = {
  batchId: string;
  count: number;
  codes: AdminRedemption[];
};

export type AdminAnnouncement = {
  id: number;
  title: string;
  content: string;
  level: "info" | "warning" | "danger";
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export type AdminSettings = Record<string, unknown>;

export type AuditLog = {
  id: number;
  actorId: number;
  targetUserId: number | null;
  action: string;
  target: string;
  amount: number;
  detail: string; // JSON string
  ip: string;
  createdAt: string;
  actorEmail?: string;
  targetEmail?: string;
};
