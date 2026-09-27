import { config, WebConfig, type ConfigValue, type EventStoreConfig } from '../../../config';
import { router } from '../router';

/**
 * 返回当前完整配置 + 默认值 + 是否需要重启。
 * 前端用它渲染表单和判断提示。
 */
router.get('/config', ctx => {
  ctx.body = {
    value: config.value,
    defaultValue: config.defaultValue,
    needsRestart: config.needsRestart(),
    restartReasons: config.restartReasons(),
  };
});

/**
 * 局部更新 eventStore 配置。
 * body: { eventStore?: Partial<EventStoreConfig> }
 */
router.put('/config', ctx => {
  const body = (ctx.request as any).body as Partial<ConfigValue> | undefined;
  if (!body || typeof body !== 'object') {
    ctx.status = 400;
    ctx.body = { error: 'invalid body' };
    return;
  }

  if (body.eventStore) {
    const patch = body.eventStore as Partial<EventStoreConfig>;

    // 类型与取值校验
    if (patch.maxCachedGroups !== undefined) {
      if (!Number.isInteger(patch.maxCachedGroups) || patch.maxCachedGroups <= 0) {
        ctx.status = 400;
        ctx.body = { error: 'maxCachedGroups must be a positive integer' };
        return;
      }
    }
    if (patch.maxCachedMessages !== undefined) {
      if (!Number.isInteger(patch.maxCachedMessages) || patch.maxCachedMessages <= 0) {
        ctx.status = 400;
        ctx.body = { error: 'maxCachedMessages must be a positive integer' };
        return;
      }
    }
    if (patch.flushInterval !== undefined) {
      if (!Number.isInteger(patch.flushInterval) || patch.flushInterval <= 0) {
        ctx.status = 400;
        ctx.body = { error: 'flushInterval must be a positive integer' };
        return;
      }
    }
    if (patch.enableMessageStorage !== undefined) {
      if (typeof patch.enableMessageStorage !== 'boolean') {
        ctx.status = 400;
        ctx.body = { error: 'enableMessageStorage must be a boolean' };
        return;
      }
    }
    if (patch.dataPath !== undefined && typeof patch.dataPath !== 'string') {
      ctx.status = 400;
      ctx.body = { error: 'dataPath must be a string' };
      return;
    }
    if (patch.databaseName !== undefined && typeof patch.databaseName !== 'string') {
      ctx.status = 400;
      ctx.body = { error: 'databaseName must be a string' };
      return;
    }
  }

  if (body.web) {
    const webPatch = body.web as Partial<WebConfig>;

    if (webPatch.login?.enabled !== undefined && typeof webPatch.login?.enabled !== 'boolean') {
      ctx.status = 400;
      ctx.body = { error: 'web.enabled must be a boolean' };
      return;
    }

    if (webPatch.login) {
      if (webPatch.login.username !== undefined && typeof webPatch.login.username !== 'string') {
        ctx.status = 400;
        ctx.body = { error: 'web.login.username must be a string' };
        return;
      }
      if (webPatch.login.password !== undefined && typeof webPatch.login.password !== 'string') {
        ctx.status = 400;
        ctx.body = { error: 'web.login.password must be a string' };
        return;
      }
    }
  }

  config.saveValue(body);
  ctx.body = {
    ok: true,
    value: config.value,
    needsRestart: config.needsRestart(),
    restartReasons: config.restartReasons(),
  };
});

/**
 * 恢复 eventStore 到默认值。
 * body: { section?: 'eventStore' } 目前只支持 eventStore
 */
router.post('/config/reset', ctx => {
  const body = (ctx.request as any).body ?? {};
  if (body.section === 'eventStore' || body.section === undefined) {
    config.updateEventStore(config.defaultValue.eventStore);
  }
  ctx.body = {
    ok: true,
    value: config.value,
    needsRestart: config.needsRestart(),
    restartReasons: config.restartReasons(),
  };
});

export default router;
