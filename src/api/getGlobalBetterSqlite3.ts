import { getGlobalNs } from './getGlobalNs';

type DatabaseConstructor = typeof import('better-sqlite3');

/**
 * 获取全局共享的 better-sqlite3 构造函数。
 *
 * ## 用途
 *
 * 同一进程内多个版本的本插件共存时，若各自 import better-sqlite3，
 * 会因模块路径不同而重复加载原生 addon，导致内存翻倍。
 * 本函数通过全局命名空间共享构造函数，保证只加载一次。
 *
 * ## 注意事项
 *
 * - **同步返回**：若全局命名空间尚未挂载，返回 `undefined`。
 * - **不主动加载**：本函数只读全局，不触发 import。
 *   真正加载由 `getGlobalBetterSqlite3()`（singletons 模块）负责。
 * - 一般不应由插件直接调用；如需连接数据库，请用 `useEventStore()`。
 *
 * @returns better-sqlite3 构造函数，或 undefined
 */
export function getGlobalBetterSqlite3() {
  const ns = getGlobalNs();
  return ns.getGlobalBetterSqlite3?.() as DatabaseConstructor | undefined;
}
