import type { EventStore } from '../store/classes/EventStore';
import { getGlobalNs } from './getGlobalNs';

/**
 * 获取全局共享的 EventStore 单例。
 *
 * ## 用途
 *
 * 同一进程内多个版本的本插件共存时，共享同一个 EventStore 实例，
 * 保证 `_cache`、`_instances`、`messageBuffer` 只有一份。
 *
 * ## 注意事项
 *
 * - **同步返回**：若全局命名空间尚未挂载，返回 `undefined`。
 * - **不主动创建**：本函数只读全局。真正创建单例由
 *   `singletons.getGlobalEventStore()` 负责。
 * - **一般不应由插件直接调用**：推荐用 `useEventStore()`，
 *   它会自动绑定当前事件的 Platform / BotId，并处理惰性加载。
 *
 * @returns EventStore 单例，或 undefined
 */
export function getGlobalEventStore() {
  const ns = getGlobalNs();
  return ns.getGlobalEventStore?.() as EventStore | undefined;
}
