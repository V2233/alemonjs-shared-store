import cors from '@koa/cors';
import { PLUGIN_NAME } from 'alemonjs-shared-store/vars';
import { existsSync } from 'fs';
import Koa from 'koa';
import serve from 'koa-static';
import { join } from 'path';

import { PORT } from './config.js';
import router from './routes';
import { closeAll } from './store.js';

const app = new Koa();

app.use(cors());

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: (e as Error).message };
    console.error(e);
  }
});

app.use(router.routes()).use(router.allowedMethods());

const webDist = join(process.cwd(), '../web/dist');
if (existsSync(webDist)) {
  app.use(serve(webDist));
  app.use(async ctx => {
    if (!ctx.path.startsWith('/api')) {
      ctx.type = 'html';
      ctx.body = (await import('fs')).readFileSync(join(webDist, 'index.html'), 'utf8');
    }
  });
}

const server = app.listen(PORT, () => {
  console.log(`[${PLUGIN_NAME}] http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  closeAll();
  server.close(() => process.exit(0));
});
