import { config } from '../../../config';
import { createSession, destroySession, verifySession } from '../../auth';
import { router } from '../router';

/**
 * 检查当前登录态。
 * - 未启用登录：直接返回 { enabled: false, authenticated: true }
 * - 已启用登录：根据 Authorization 头判断
 */
router.get('/auth/status', ctx => {
  const web = config.value.web;

  if (!web.login.enabled) {
    ctx.body = { enabled: false, authenticated: true };
    return;
  }

  const token = extractToken(ctx);
  if (!token) {
    ctx.body = { enabled: true, authenticated: false };
    return;
  }

  // 固定 token
  if (web.login.token && token === web.login.token) {
    ctx.body = { enabled: true, authenticated: true, username: 'token' };
    return;
  }

  // session
  const session = verifySession(token);
  if (session) {
    ctx.body = { enabled: true, authenticated: true, username: session.username };
    return;
  }

  ctx.body = { enabled: true, authenticated: false };
});

/**
 * 登录。
 * body: { username?: string; password?: string; token?: string }
 */
router.post('/auth/login', ctx => {
  const web = config.value.web;
  if (!web.login.enabled) {
    ctx.body = { ok: true, token: '', message: '登录未启用' };
    return;
  }

  const body = (ctx.request as any).body ?? {};

  // 1) 固定 token 登录
  if (body.token) {
    if (web.login.token && body.token === web.login.token) {
      ctx.body = { ok: true, token: body.token };
      return;
    }
    ctx.status = 401;
    ctx.body = { error: 'token 无效' };
    return;
  }

  // 2) 账密登录
  const { username, password } = body;
  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { error: '缺少用户名或密码' };
    return;
  }
  if (username !== web.login.username || password !== web.login.password) {
    ctx.status = 401;
    ctx.body = { error: '用户名或密码错误' };
    return;
  }

  const session = createSession(username);
  ctx.body = { ok: true, token: session.token };
});

/**
 * 登出。
 */
router.post('/auth/logout', ctx => {
  const token = extractToken(ctx);
  if (token) destroySession(token);
  ctx.body = { ok: true };
});

/**
 * 修改账密。
 * body: { oldPassword: string; username?: string; password?: string; token?: string }
 *
 * 需要已登录。修改后当前 session 失效，需重新登录。
 */
router.put('/auth/account', ctx => {
  const web = config.value.web;

  // 未启用登录时不允许改（避免无鉴权改配置）
  if (!web.login.enabled) {
    ctx.status = 403;
    ctx.body = { error: '登录未启用，无法修改账密' };
    return;
  }

  // 校验已登录
  const currentToken = extractToken(ctx);
  let authed = false;
  if (web.login.token && currentToken === web.login.token) authed = true;
  else if (currentToken && verifySession(currentToken)) authed = true;

  if (!authed) {
    ctx.status = 401;
    ctx.body = { error: '未登录' };
    return;
  }

  const body = (ctx.request as any).body ?? {};
  const { oldPassword, username, password, token } = body;

  // 校验旧密码（token 登录时跳过）
  if (currentToken !== web.login.token) {
    if (!oldPassword || oldPassword !== web.login.password) {
      ctx.status = 401;
      ctx.body = { error: '旧密码错误' };
      return;
    }
  }

  // 校验新值
  if (username !== undefined && typeof username !== 'string') {
    ctx.status = 400;
    ctx.body = { error: 'username 必须是字符串' };
    return;
  }
  if (password !== undefined && typeof password !== 'string') {
    ctx.status = 400;
    ctx.body = { error: 'password 必须是字符串' };
    return;
  }
  if (token !== undefined && typeof token !== 'string') {
    ctx.status = 400;
    ctx.body = { error: 'token 必须是字符串' };
    return;
  }

  config.saveValue({
    web: {
      ...web,
      login: {
        ...web.login,
        username: username ?? web.login.username,
        password: password ?? web.login.password,
        token: token ?? web.login.token,
      },
    },
  });

  // 让所有 session 失效
  destroySession(currentToken!);

  ctx.body = { ok: true };
});

/** 从 Authorization 头或 query 提取 token */
function extractToken(ctx: any): string | null {
  const auth = ctx.headers['authorization'];
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  // 兜底：query 里带 token（不推荐，但方便调试）
  if (ctx.query?.token) return String(ctx.query.token);
  return null;
}

export default router;
