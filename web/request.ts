import { BASE_PATH } from './vars';
const BASE = BASE_PATH + '/api';

const TOKEN_KEY = 'alemonjs-shared-store-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// 给所有请求加 Authorization 头
export async function req<T>(url: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + url + qs, { headers });
  if (res.status === 401) {
    clearToken();
    // 触发全局 401 处理
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reqJson<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: any
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---------------- 类型 ----------------

export interface AuthStatusResp {
  enabled: boolean;
  authenticated: boolean;
  username?: string;
}

export interface LoginResp {
  ok: true;
  token: string;
}

export interface AccountPatch {
  oldPassword?: string;
  username?: string;
  password?: string;
  token?: string;
}
