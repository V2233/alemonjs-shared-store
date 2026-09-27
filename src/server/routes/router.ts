import { bodyParser } from '@koa/bodyparser';
import Router from '@koa/router';

import { config } from '../../config';
import { verifySession } from '../auth';

const router = new Router({ prefix: '/api' });

router.use(bodyParser());

// 鉴权中间件：作用于该 router 下所有路由
router.use(async (ctx, next) => {
  if (ctx.method === 'OPTIONS') {
    await next();
    return;
  }

  const path = ctx.path;

  // 非 /api 请求放行（静态资源、SPA）
  if (!path.startsWith('/api')) {
    await next();
    return;
  }

  // auth 路由放行
  if (path.startsWith('/api/auth')) {
    await next();
    return;
  }

  // 未启用登录放行
  const web = config.value.web;
  if (!web.login.enabled) {
    await next();
    return;
  }

  // 提取 token
  const auth = ctx.headers['authorization'];
  let token: string | null = null;
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (ctx.query?.token) {
    token = String(ctx.query.token);
  }

  if (!token) {
    ctx.status = 401;
    ctx.body = { error: '未登录' };
    return;
  }

  // 固定 token
  if (web.login.token && token === web.login.token) {
    await next();
    return;
  }

  // session
  const session = verifySession(token);
  if (!session) {
    ctx.status = 401;
    ctx.body = { error: '登录已过期，请重新登录' };
    return;
  }

  await next();
});

export { router };
