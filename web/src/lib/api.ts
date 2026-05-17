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
  allowedModels: string;
  concurrencyLimit: number;
  qpsLimit: number;
  tpsLimit: number;
  rpmLimit: number;
  tpmLimit: number;
  createdAt: string;
};

export type PaymentOrder = {
  id: number;
  orderNo: string;
  userId: number;
  provider: string;
  channel: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "COMPLETED" | "EXPIRED" | "CANCELLED" | "FAILED" | "REFUND_REQUESTED" | "REFUNDING" | "REFUNDED";
  payUrl: string;
  qrContent: string;
  providerRef: string;
  expiredAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
const DEMO_SESSION_TOKEN = "getoken-demo-session";

let demoUser: User = {
  id: 1,
  email: DEMO_LOGIN_EMAIL,
  username: "admin",
  role: "admin",
  status: "active",
  quota: 86.42,
  usedQuota: 18.76,
  groupId: 1,
  inviteCode: "GT-ADMIN",
  createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
};
let demoPaymentOrders: PaymentOrder[] = [];

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
  const demoResponse = resolveDemoRequest<T>(path, init, token);
  if (demoResponse.handled) return demoResponse.data;

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

function requestMethod(init: RequestInit): string {
  return (init.method ?? "GET").toUpperCase();
}

function requestJson(init: RequestInit): Record<string, unknown> {
  if (!init.body || typeof init.body !== "string") return {};
  try {
    const parsed = JSON.parse(init.body);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function resolveDemoRequest<T>(
  path: string,
  init: RequestInit,
  token: string | null,
): { handled: true; data: T } | { handled: false; data?: never } {
  const method = requestMethod(init);
  const body = requestJson(init);

  if (path === "/auth/login" && method === "POST") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (email === DEMO_LOGIN_EMAIL && password === DEMO_LOGIN_PASSWORD) {
      return { handled: true, data: { token: DEMO_SESSION_TOKEN } as T };
    }
  }

  if (token !== DEMO_SESSION_TOKEN) return { handled: false };

  if (path === "/user/self") {
    if (method === "PUT") {
      demoUser = { ...demoUser, username: String(body.username || demoUser.username) };
    }
    return { handled: true, data: demoUser as T };
  }

  if (path === "/user/password" && method === "PUT") {
    return { handled: true, data: {} as T };
  }

  if (path === "/auth/logout") {
    return { handled: true, data: {} as T };
  }

  if (path === "/topup/redeem" && method === "POST") {
    demoUser = { ...demoUser, quota: demoUser.quota + 50 };
    return { handled: true, data: { balance: demoUser.quota } as T };
  }

  if (path === "/topup/orders" && method === "GET") {
    return { handled: true, data: demoPaymentOrders as T };
  }

  if (path === "/topup/order" && method === "POST") {
    const order: PaymentOrder = {
      id: Date.now(),
      orderNo: `pay_demo_${Date.now()}`,
      userId: demoUser.id,
      provider: "alipay",
      channel: "alipay",
      amount: Number(body.amount || 50),
      currency: "USD",
      status: "PENDING",
      payUrl: "/dashboard/topup",
      qrContent: `GETOKEN:alipay:demo:${Number(body.amount || 50).toFixed(2)}`,
      providerRef: "",
      expiredAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      paidAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoPaymentOrders = [order, ...demoPaymentOrders].slice(0, 50);
    return { handled: true, data: { order, payUrl: order.payUrl, qrContent: order.qrContent } as T };
  }

  if (path.includes("/topup/orders/") && path.endsWith("/simulate-paid") && method === "POST") {
    const id = Number(path.match(/\/topup\/orders\/(\\d+)\/simulate-paid$/)?.[1]);
    const existing = demoPaymentOrders.find((item) => item.id === id);
    const paidAt = new Date().toISOString();
    const paid: PaymentOrder = {
      ...(existing ?? {
        id: Date.now(),
        orderNo: `pay_demo_${Date.now()}`,
        userId: demoUser.id,
        provider: "alipay",
        channel: "alipay",
        amount: 50,
        currency: "USD",
        payUrl: "/dashboard/topup",
        qrContent: "GETOKEN:alipay:demo:50.00",
        expiredAt: null,
        createdAt: paidAt,
      }),
      status: "COMPLETED",
      providerRef: "simulated",
      paidAt,
      completedAt: paidAt,
      updatedAt: paidAt,
    };
    demoPaymentOrders = [paid, ...demoPaymentOrders.filter((item) => item.id !== paid.id)].slice(0, 50);
    demoUser = { ...demoUser, quota: demoUser.quota + Number(paid.amount || 0) };
    return { handled: true, data: paid as T };
  }

  return { handled: false };
}

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
  concurrencyLimit: number;
  qpsLimit: number;
  tpsLimit: number;
  rpmLimit: number;
  tpmLimit: number;
  inviteCode: string;
  createdAt: string;
};

export type AdminUpstream = {
  id: number;
  name: string;
  type: string;
  baseUrl: string;
  status: "online" | "degraded" | "offline";
  tags: string;
  priority: number;
  weight: number;
  autoDisable: boolean;
  failureCount: number;
  failureThreshold: number;
  latencyMs: number;
  lastCheckAt: string | null;
  lastError?: string;
  note: string;
  apiKeyMask: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUpstreamAccount = {
  id: number;
  upstreamId: number;
  name: string;
  accountType: "apikey" | "oauth" | "oauth_code" | "oauth_setup_token" | "setup-token" | "upstream" | "service_account";
  status: "online" | "degraded" | "offline" | "cooling";
  priority: number;
  weight: number;
  rpmLimit: number;
  tpmLimit: number;
  concurrencyLimit: number;
  latencyMs: number;
  lastUsedAt: string | null;
  lastCheckAt: string | null;
  oauthExpiresAt: string | null;
  proxyUrl: string;
  lastError?: string;
  note: string;
  apiKeyMask: string;
  oauthAccessTokenMask: string;
  oauthRefreshTokenMask: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminOpsSnapshot = {
  windowSeconds: number;
  qps: number;
  tps: number;
  requests: number;
  tokens: number;
  errors: number;
  errorRate: number;
  onlineAccounts: number;
  degradedAccounts: number;
  offlineAccounts: number;
  activeAccountConcurrency: number;
  activeUserConcurrency: number;
  updatedAt: string;
};

export type AdminOpsAccount = {
  id: number;
  upstreamId: number;
  upstreamName: string;
  name: string;
  status: "online" | "degraded" | "offline" | "cooling";
  priority: number;
  weight: number;
  rpmLimit: number;
  tpmLimit: number;
  concurrencyLimit: number;
  currentConcurrency: number;
  latencyMs: number;
  lastUsedAt: string | null;
  lastCheckAt: string | null;
  lastError: string;
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

// PublicSettings is what /api/public/settings returns to the login / register
// pages. Defaults mirror the backend env defaults so the UI degrades sanely if
// the endpoint is unreachable.
export type PublicSettings = {
  registrationEnabled: boolean;
  emailVerifyRequired: boolean;
  inviteRequired: boolean;
  emailSuffixWhitelist: string[];
  githubOAuthEnabled: boolean;
};

export const defaultPublicSettings: PublicSettings = {
  registrationEnabled: true,
  emailVerifyRequired: true,
  inviteRequired: false,
  emailSuffixWhitelist: [],
  githubOAuthEnabled: false,
};

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
