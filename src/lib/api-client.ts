"use client";

/**
 * Tiny API client for the admin dashboard.
 * Stores the JWT in localStorage and attaches it as a Bearer token.
 */

const TOKEN_KEY = "medicare_admin_token";
const USER_KEY = "medicare_admin_user";
const API = "/api/v1";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: unknown) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  auth: boolean;
  constructor(message: string, code: string, status: number, auth = false) {
    super(message);
    this.code = code;
    this.status = status;
    this.auth = auth;
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<{ success: boolean; data: T; message?: string; pagination?: Pagination; error?: { code: string; message: string } }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 401) {
    clearSession();
    throw new ApiError("Authentication required.", "AUTH_REQUIRED", 401, true);
  }

  // binary responses
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, "HTTP_ERROR", res.status);
    return { success: true, data: res as unknown as T };
  }

  const json = await res.json();
  if (!res.ok || !json.success) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    const code = json?.error?.code || "HTTP_ERROR";
    throw new ApiError(msg, code, res.status);
  }
  return json;
}
