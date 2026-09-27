/**
 * 全局命名空间工具。
 *
 * alemonjs 插件体系允许多个插件共享进程内状态。
 * 本模块定义本插件的全局命名空间路径：`globalThis.plugins['alemonjs-shared-store']`。
 *
 * 该命名空间用于存放：
 * - `event-store`：EventStore 单例
 * - `better-sqlite3-ctor`：better-sqlite3 构造函数
 * - `getGlobalEventStore` / `getGlobalBetterSqlite3`：惰性获取函数
 * - `state`：加载状态
 * - `versions`：各插件依赖的本包版本集合
 */

export const APP_NAME = 'alemonjs-shared-store';

/**
 * 获取本插件的全局命名空间对象。
 *
 * - 若 `globalThis.plugins` 不存在，会初始化。
 * - 若本插件的命名空间不存在，会初始化。
 * - 多次调用返回同一个对象。
 *
 * @example
 * ```
 * const ns = getGlobalNs();
 * ns['event-store']; // EventStore 单例（可能尚未创建）
 * ```
 */
export function getGlobalNs(): Record<string, any> {
  const g = globalThis as any;
  g.plugins ??= {};
  g.plugins[APP_NAME] ??= {};
  return g.plugins[APP_NAME];
}
