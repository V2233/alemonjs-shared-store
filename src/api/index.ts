/**
 * 对外暴露的 API 入口。
 *
 * ## 主入口
 *
 * - `useEventStore`：插件作者应使用的主 API。自动绑定当前事件的
 *   Platform / BotId，返回一个已绑定上下文的 store 代理。
 *
 * ## 辅助入口
 *
 * - `getGlobalNs`：获取本插件的全局命名空间。
 * - `getGlobalEventStore`：获取全局 EventStore 单例（同步，可能为 undefined）。
 * - `getGlobalBetterSqlite3`：获取全局 better-sqlite3 构造函数。
 *
 * 一般情况下，插件只需 `import { useEventStore } from 'alemonjs-shared-store'`。
 */

export * from './getGlobalNs';

export * from './getGlobalBetterSqlite3';

export * from './getGlobalEventStore';

export * from './useEventStore';
