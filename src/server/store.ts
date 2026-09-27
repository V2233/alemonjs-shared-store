import { APP_NAME, getGlobalNs } from '../api/getGlobalNs';
import { config } from '../config';
import type { EventStore } from '../store/classes/EventStore';

export interface DbScope {
  platform: string;
  botId: string;
  /** 实际 db 文件路径（从 eventStore 的配置推导） */
  dbPath: string;
  db: import('better-sqlite3').Database;
}

const _scopes = new Map<string, DbScope>();

function scopeKey(platform: string, botId: string): string {
  return `${platform}:${botId}`;
}

// #region ---------------- eventStore 解析 ----------------

let _eventStorePromise: Promise<EventStore | null> | null = null;

/**
 * 惰性拿全局 eventStore 实例。
 * - 全局命名空间已挂载 → 直接拿
 * - 未挂载 → 动态 import 挂载逻辑
 * - 实在拿不到 → null（server 单独跑时不该发生）
 */
async function resolveEventStore(): Promise<EventStore | null> {
  const ns = getGlobalNs();

  // 1) 全局已有
  if (ns['event-store']) return ns['event-store'] as EventStore;

  // 2) 全局有 getter
  if (typeof ns['getGlobalEventStore'] === 'function') {
    return ns['getGlobalEventStore']() as EventStore;
  }

  // 3) 惰性 import 兜底
  if (!_eventStorePromise) {
    _eventStorePromise = import('../store/singletons')
      .then(mod => {
        if (typeof mod.getGlobalEventStore === 'function') {
          return mod.getGlobalEventStore();
        }
        return null;
      })
      .catch(e => {
        logger.warn(`[${APP_NAME}][ServerStore] 动态加载 eventStore 失败：`, e);
        return null;
      });
  }
  return _eventStorePromise;
}

// #endregion

// #region ---------------- scope 解析 ----------------

/**
 * 拿一个 scope。惰性：
 * - 首次调用时 resolve eventStore
 * - 调 eventStore.getRawDb 拿到 db 句柄
 * - 缓存到 _scopes
 */
export async function getScopeAsync(platform: string, botId: string): Promise<DbScope | null> {
  const key = scopeKey(platform, botId);
  const cached = _scopes.get(key);
  if (cached) return cached;

  const eventStore = await resolveEventStore();
  if (!eventStore) return null;

  const raw = await eventStore.getRawDb(platform, botId);
  if (!raw) return null;

  const scope: DbScope = {
    platform,
    botId,
    dbPath: raw.dbPath,
    db: raw.db,
  };
  _scopes.set(key, scope);
  return scope;
}

/**
 * 同步版：只查已缓存的 scope，不触发惰性初始化。
 * 适合在“已经知道 eventStore 已挂载”的热路径用。
 */
export function getScope(platform: string, botId: string): DbScope | null {
  return _scopes.get(scopeKey(platform, botId)) ?? null;
}

/**
 * 预填充：把 eventStore 里已加载的实例全部塞进 _scopes。
 * 可选，用于启动时对齐。
 */
export async function syncScopes(): Promise<DbScope[]> {
  const eventStore = await resolveEventStore();
  if (!eventStore) return [];

  const loaded = eventStore.listLoadedKeys();
  const result: DbScope[] = [];
  for (const { platform, botId } of loaded) {
    const s = await getScopeAsync(platform, botId);
    if (s) result.push(s);
  }
  return result;
}

// #endregion

// #region ---------------- 平台 / BotId 枚举 ----------------

/**
 * 枚举所有平台。
 * 不遍历磁盘，只从 eventStore 已加载的实例里取。
 */
export async function listPlatforms(): Promise<string[]> {
  const eventStore = await resolveEventStore();
  if (!eventStore) return [];
  const set = new Set<string>();
  for (const { platform } of eventStore.listLoadedKeys()) set.add(platform);
  return [...set];
}

/**
 * 枚举某平台下的 BotId。
 */
export async function listBots(platform: string): Promise<string[]> {
  const eventStore = await resolveEventStore();
  if (!eventStore) return [];
  const set = new Set<string>();
  for (const k of eventStore.listLoadedKeys()) {
    if (k.platform === platform) set.add(k.botId);
  }
  return [...set];
}

// #endregion

// #region ---------------- 关闭 / 重载 ----------------

/**
 * server 侧不再持有独立连接，close 只清缓存。
 * 真正的 db 关闭交给 eventStore。
 */
export function closeAll(): void {
  _scopes.clear();
}

/**
 * 兼容旧调用名（原 discoverScopes 在启动时被调）。
 * 现在改成惰性同步，不阻塞启动。
 */
export async function discoverScopes(): Promise<DbScope[]> {
  return syncScopes();
}

/** config 变更后，清掉 scope 缓存，下次请求重新拿句柄 */
config.onReload(() => {
  // logger.info(`[${APP_NAME}][ServerStore] config 已重载，清空 scope 缓存`);
  _scopes.clear();
});

// #endregion
