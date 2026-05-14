export type UserRole = "user" | "admin";

export type User = {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  quota: number;
  usedQuota: number;
  group: string;
  inviteCode: string;
  createdAt: string;
};

export type Token = {
  id: number;
  name: string;
  key: string;
  status: 1 | 0;
  remainQuota: number;
  unlimitedQuota: boolean;
  expiredTime: number;
  group: string;
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
const DEMO_SESSION_TOKEN = "demo-admin-session";
const DEMO_USER_STORAGE_KEY = "getoken.demo-user";
const DEMO_PASSWORD_STORAGE_KEY = "getoken.demo-password";

export const DEMO_LOGIN_EMAIL = "admin@getoken.dev";
export const DEMO_LOGIN_PASSWORD = "Getoken123!";

const defaultDemoUser: User = {
  id: 1,
  email: DEMO_LOGIN_EMAIL,
  username: "Demo Admin",
  role: "admin",
  quota: 500000,
  usedQuota: 18420,
  group: "default",
  inviteCode: "GETOKEN",
  createdAt: "2026-01-01T00:00:00.000Z",
};

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

function readDemoUser(): User {
  if (typeof window === "undefined") return defaultDemoUser;
  const raw = localStorage.getItem(DEMO_USER_STORAGE_KEY);
  if (!raw) return defaultDemoUser;

  try {
    const parsed = JSON.parse(raw) as Partial<User>;
    return { ...defaultDemoUser, ...parsed };
  } catch {
    return defaultDemoUser;
  }
}

function writeDemoUser(user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
}

function readDemoPassword(): string {
  if (typeof window === "undefined") return DEMO_LOGIN_PASSWORD;
  return localStorage.getItem(DEMO_PASSWORD_STORAGE_KEY) ?? DEMO_LOGIN_PASSWORD;
}

function writeDemoPassword(password: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_PASSWORD_STORAGE_KEY, password);
}

function isDemoSession(token: string | null) {
  return token === DEMO_SESSION_TOKEN;
}

function parseJsonBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== "string") return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const method = (init.method ?? "GET").toUpperCase();
  const payload = parseJsonBody(init);
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (path === "/auth/login" && method === "POST") {
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");

    if (email === DEMO_LOGIN_EMAIL.toLowerCase() && password === readDemoPassword()) {
      return { token: DEMO_SESSION_TOKEN } as T;
    }
  }

  if (isDemoSession(token)) {
    if (path === "/user/self" && method === "GET") {
      return readDemoUser() as T;
    }

    if (path === "/user/self" && method === "PUT") {
      const currentUser = readDemoUser();
      const nextUser: User = {
        ...currentUser,
        username:
          typeof payload.username === "string" && payload.username.trim() !== ""
            ? payload.username.trim()
            : currentUser.username,
      };
      writeDemoUser(nextUser);
      return nextUser as T;
    }

    if (path === "/user/password" && method === "PUT") {
      const oldPassword = String(payload.old ?? "");
      const nextPassword = String(payload.new ?? "");

      if (oldPassword !== readDemoPassword()) {
        throw new ApiError("原密码不正确", 400, { message: "原密码不正确" });
      }

      writeDemoPassword(nextPassword);
      return {} as T;
    }
  }

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
    "data" in (body as Record<string, unknown>) &&
    !("items" in (body as Record<string, unknown>) && "data" in (body as Record<string, unknown>))
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const fetcher = <T = unknown>(path: string) => apiFetch<T>(path);
