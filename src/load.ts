import { bumpStoreVersion } from 'alemonjs';
import { PLUGIN_ROOT_DIR } from 'alemonjs-shared-store/vars';
import { join } from 'path';

import { APP_NAME } from './api/getGlobalNs';
import router from './server/routes';
import { getGlobalEventStore, ingestMessageEvent } from './store';

const eventStore = getGlobalEventStore();

export function loadApp(appName = APP_NAME) {
  const core = global.alemonjsCore;
  if (!core) return false;
  if (!core.storeChildrenApp || !core.runtimeApps) return false;
  if (core.storeChildrenApp[appName] && core.runtimeApps[appName]) return true;

  core.storeChildrenApp[appName] = {
    name: appName,
    middleware: [],
    middlewareResponse: {},
    response: [],
    cycle: {
      // 确保在其它插件中间件之前加载
      onEventStart: async ({ event }) => {
        await ingestMessageEvent(eventStore, event);
        // logger.info(`[onEventStart: ${event.name}]`, JSON.stringify(event, null, 2));
      },
    },
    register: {
      koaRouter: router,
    },
  };
  core.runtimeApps[appName] = {
    name: appName,
    kind: 'plugin',
    enabled: true,
    status: 'ready',
    rootDir: PLUGIN_ROOT_DIR,
    mainPath: join(PLUGIN_ROOT_DIR, 'src', 'index.ts'),
    capabilities: { event: true, httpApi: true, web: true, schedule: false, expose: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  bumpStoreVersion();
  logger.info(`[${appName}]加载成功！`);

  return true;
}

loadApp();
const timer = setInterval(() => {
  if (loadApp()) clearInterval(timer);
}, 500);
