import { randomBytes } from 'crypto';

interface Session {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL = 7 * 24 * 3600 * 1000; // 7 天

const _sessions = new Map<string, Session>();

/** 签发一个新 session */
export function createSession(username: string): Session {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const session: Session = {
    token,
    username,
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  };
  _sessions.set(token, session);
  return session;
}

/** 校验 token 是否有效 */
export function verifySession(token: string): Session | null {
  const s = _sessions.get(token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    _sessions.delete(token);
    return null;
  }
  return s;
}

/** 销毁 session */
export function destroySession(token: string): void {
  _sessions.delete(token);
}

/** 清理过期 session（可定时调） */
export function cleanupSessions(): void {
  const now = Date.now();
  for (const [token, s] of _sessions) {
    if (s.expiresAt < now) _sessions.delete(token);
  }
}
