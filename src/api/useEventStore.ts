import { useEvent } from 'alemonjs';
import { PLUGIN_NAME } from 'alemonjs-shared-store/vars';

import { getGlobalEventStore } from './getGlobalEventStore';
import type {
  ICountActiveUsersParams,
  ICountMessagesParams,
  IDeleteGroupMemberParams,
  IEnsureGroupParams,
  IFindMemberParams,
  IGetGroupMemberCountParams,
  IGetGroupMemberParams,
  IGetGroupMessageCountParams,
  IGetGroupParams,
  IGetMessageByIdParams,
  IGetMessagesParams,
  IGetUserParams,
  IGetUsersParams,
  IHasGroupParams,
  IRemoveGroupMemberParams,
  IRemoveMessageParams,
  IRemoveMessagesParams,
  ISetGroupMemberParams,
  ISetGroupParams,
} from './types';

/** 单值范围：undefined → fallback，null → undefined，其他 → 原值 */
function resolveScopeSingle(
  v: string | null | undefined,
  fallback: string | undefined
): string | undefined {
  if (v === null) return undefined;
  return v ?? fallback;
}

/**
 * 解析范围值：
 * - undefined → fallback（默认值）
 * - null      → undefined（不限，不拼 SQL 条件）
 * - 其他      → 原值
 */
function resolveScope(v: null, fallback: string | undefined): undefined;
function resolveScope(v: string[] | undefined, fallback: string | undefined): string[] | undefined;
function resolveScope(v: string | undefined, fallback: string | undefined): string | undefined;
function resolveScope(
  v: string | string[] | null | undefined,
  fallback: string | undefined
): string | string[] | undefined;
function resolveScope(
  v: string | string[] | null | undefined,
  fallback: string | undefined
): string | string[] | undefined {
  if (v === null) return undefined;
  if (Array.isArray(v)) {
    if (v.length === 0) return undefined;
    return v;
  }
  return v ?? fallback;
}

/**
 * 在 `onResponse` / `onMessage` 等回调中调用，自动绑定当前事件的
 * `Platform` + `BotId`，返回一个已绑定上下文的 store 代理。
 *
 * ## 基本用法
 *
 * ```ts
 * import { useEvent } from 'alemonjs';
 * import { useEventStore } from 'alemonjs-shared-store';
 *
 * export default async() => {
 *   const [event, next] = useEvent({
 *     selects: ['message.create'],
 *     prefix: '/获取'
 *   })
 *
 *   // 匹配结果为布尔值
 *   if (!event.match.selects || !event.match.prefix) {
 *     next()
 *     return
 *   }
 *
 *   const store = useEventStore();
 *
 *   switch(event.current.MessageText) {
 *     case '/获取群员列表': {
 *       const members = await store.getGroupMembers()
 *       store.toArray(members).forEach(member=>{
 *         logger.info(
 *           `UserId: ${member.user_id}` +
 *           `UserName: ${member.nickname}` +
 *           `UserAvatar: ${member.avatar}` +
 *           `是否已退群: ${member.removed?'是':'否'}`
 *         )
 *       })
 *       break
 *     }
 *   }
 *
 * })
 *
 * ```
 * ## 关于所有`set`/`remove`/`delete`方法
 *
 * - 一般情况下这些方法仅在内部使用，由于所有插件共享数据，滥用极大概率导致其它插件功能崩溃
 *
 * ## 关于默认值（重要）
 *
 * 所有方法的 `GuildId` / `UserId` 若不传，默认取当前事件中的`GuildId` 和 `UserId`：
 * - `GuildId` → `event.current.GuildId`
 * - `UserId` → `event.current.UserId`
 *
 * 这在“处理当前消息发送者 / 当前群”时最方便。
 *
 * ## 关于平台 / BotId
 *
 * 平台和 BotId 在调用 `useEventStore()` 时绑定，后续所有方法
 * 都用同一份上下文。若需跨平台调用，显式传 `Platform` / `BotId`：
 *
 * ```ts
 * const store = useEventStore({ Platform: 'discord', BotId: 'shared' });
 * ```
 *
 * ## 关于惰性初始化
 *
 * 首次调用任一方法时，会触发对应 `platform:botId` 实例的创建。
 * 全局命名空间尚未挂载时，会动态 import 兜底，不存在时序问题。
 *
 * @param args 透传给 alemonjs 的 useEvent
 */
export function useEventStore(...args: Parameters<typeof useEvent>) {
  const eventStore = getGlobalEventStore()!;
  if (!eventStore) {
    logger.warn(
      `[${PLUGIN_NAME}][useEventStore] 未初始化完成，本条消息将不被 eventStore 记录，此提示不是Bug。`
    );
  }

  const [event] = useEvent(...args);
  const opts = args[0];
  const platform = opts?.Platform ?? (event.current.Platform as string);
  const botId = opts?.BotId ?? event.current.BotId ?? 'shared';

  if (!platform) {
    logger.warn(`[${PLUGIN_NAME}][useEventStore] 事件上下文缺少 Platform`);
  }
  if (!botId) {
    logger.warn(`[${PLUGIN_NAME}][useEventStore] 事件上下文缺少 BotId`);
  }

  const defaultGuildId = event.current.GuildId ?? '';
  const defaultUserId = event.current.UserId ?? '';

  return {
    // #region ---------------- 群 ----------------

    /**
     * 判断群是否已入库。
     *
     * @example
     * if (await store.hasGroup()) { ... }
     *
     * @remarks
     * 只查 `groups` 表，不加载成员。适合“判断该群是否首次出现”。
     */
    hasGroup: (params: IHasGroupParams = {}) =>
      eventStore.hasGroup(platform, botId, params.GuildId ?? defaultGuildId),

    /**
     * 确保群存在，不存在则创建空群并返回。
     *
     * @example
     * const group = await store.ensureGroup();
     *
     * @remarks
     * - 若群已存在，返回已有群对象（可能含成员）。
     * - 若群不存在，创建一个空群并标脏，下次 flush 落库。
     * - 一般不需要手动调用；`setGroupMember` 会自动 ensure。
     */
    ensureGroup: (params: IEnsureGroupParams = {}) =>
      eventStore.ensureGroup(platform, botId, params.GuildId ?? defaultGuildId),

    /**
     * 获取群对象（含所有成员）。
     *
     * @example
     * const group = await store.getGroup();
     * if (group) {
     *   for (const [uid, member] of Object.entries(group.members)) { ... }
     * }
     *
     * @returns 群对象；群不存在返回 null
     *
     * @remarks
     * - 命中 LRU 缓存时直接返回，未命中则从 db 加载并塞缓存。
     * - 返回的 `members` 是**共享引用**，直接改字段不会自动标脏。
     *   要更新成员请用 `setGroupMember`。
     */
    getGroup: (params: IGetGroupParams = {}) =>
      eventStore.getGroup(platform, botId, params.GuildId ?? defaultGuildId),

    /**
     * 覆盖写入整个群对象。
     *
     * @remarks
     * - 会**整体替换**缓存里的群对象，慎用。
     * - 一般用 `setGroupMember` 增量更新成员，别用这个。
     */
    setGroup: (params: ISetGroupParams) =>
      eventStore.setGroup(platform, botId, params.GuildId ?? defaultGuildId, params.value),

    /**
     * 列出当前实例下所有已入库的群号。
     *
     * @example
     * const ids = await store.getAllGroupIds();
     *
     * @remarks
     * 返回的是**当前 platform:botId** 下的群，不含其他 bot 的群。
     * 大表慎用（会一次返回全部 group_id）。
     */
    getAllGroupIds: () => eventStore.getAllGroupIds(platform, botId),

    /**
     * 获取群内成员数（不含已退群）。
     *
     * @example
     * const count = await store.getGroupMemberCount();
     */
    getGroupMemberCount: (params: IGetGroupMemberCountParams = {}) =>
      eventStore.getGroupMemberCount(platform, botId, params.GuildId ?? defaultGuildId),

    /**
     * 获取群内消息数。
     *
     * @example
     * const count = await store.getGroupMessageCount();
     * const all = await store.getGroupMessageCount({ includeRemoved: true });
     *
     * @remarks
     * 默认不含已撤销消息。要统计全部传 `includeRemoved: true`。
     */
    getGroupMessageCount: (params: IGetGroupMessageCountParams = {}) =>
      eventStore.getGroupMessageCount(
        platform,
        botId,
        params.GuildId ?? defaultGuildId,
        params.includeRemoved
      ),

    // #endregion

    // #region ---------------- 用户 ----------------

    /**
     * 从 `users` 表查询单个用户。
     *
     * @example
     * const user = await store.getUser({ UserId: 'xxx' });
     *
     * @remarks
     * - 只查 `users` 表，不关心“这个用户在哪个群”。
     * - 不传 `UserId` 时默认查当前发送者。
     * - 用户不存在返回 null。
     */
    getUser: (params: IGetUserParams = {}) =>
      eventStore.getUser(platform, botId, params.UserId ?? defaultUserId),

    /**
     * 从 `users` 表批量查询用户。
     *
     * @returns `userId -> 用户信息` 的对象。
     *
     * @example
     * // 查全部用户（最多 10 万，大表慎用）
     * const all = await store.getUsers();
     *
     * // 查全部用户，限制 1000 条
     * const top = await store.getUsers({ limit: 1000 });
     *
     * // 查指定用户
     * const some = await store.getUsers({ UserIds: ['a', 'b'] });
     * some['a']?.username;
     *
     * // 空数组 = 返回空对象
     * const empty = await store.getUsers({ UserIds: [] });  // {}
     *
     * @remarks
     * - 返回 `userId -> 用户信息` 的对象。
     * - 不传 `UserIds` 时返回全部用户，受 `limit` 限制（默认 100000，大表慎用）。
     * - 传了 `UserIds` 时，`limit` 被忽略；单次 `IN` 建议不超过 500 个。
     * - 返回的是**用户级信息**（`user_id` / `username` / `avatar` / `updated_at`），
     *   不含群内字段（`nickname` / `role` / `removed`）。
     *   群内字段用 `getGroupMembers` 查。
     */
    getUsers: (params: IGetUsersParams = {}) =>
      eventStore.getUsers(platform, botId, params.UserIds, params.limit),

    /**
     * 查找成员或用户。
     *
     * 和`getGroupMember`区别，如果当前不在群，则回退到用户表查找，返回用户对象不含群员专属字段
     *
     * @example
     * // 默认优先在当前群找当前发送者
     * const m1 = await store.findMember();
     *
     * // 在当前群找指定发送者
     * const m2 = await store.findMember({ UserId: 'xxx'});
     *
     * // 在指定群找指定用户
     * const m3 = await store.findMember({ UserId: 'xxx', GuildId: 'yyy' });
     *
     * // 全局找（跨群、跨bot实例(不同botId下成员Id互通的情况下才有用，且支持未来alemonjs可能的多bot连接)）
     * const m4 = await store.findMember({ UserId: 'xxx', GuildId: null });
     *
     * @remarks
     * - **传 `GuildId`**：只在该群内找，等价于 `getGroupMember`。
     * - **不传 `GuildId`**：先在当前实例找，再回退到同平台其他已加载实例。
     *   回退是**只读**的，不会把找到的用户写回当前实例。
     * - 返回 `IStoreGroupMember`，包含 `username` / `avatar` / `nickname` / `role`。
     */
    findMember: (params: IFindMemberParams = {}) =>
      eventStore.findMember(
        platform,
        botId,
        params.UserId ?? defaultUserId,
        resolveScopeSingle(params.GuildId, defaultGuildId)
      ),

    // #endregion

    // #region ---------------- 成员 ----------------

    /**
     * 获取群成员。
     *
     * @example
     * const m = await store.getGroupMember();  // 当前群 + 当前发送者
     * const m2 = await store.getGroupMember({ UserId: 'xxx' });
     *
     * @remarks
     * - 命中缓存直接返回，未命中从 db 加载。
     * - `by-bot` 模式下，当前实例找不到会回退同平台其他 bot 的实例
     *   （只读，不写回）。
     */
    getGroupMember: (params: IGetGroupMemberParams = {}) =>
      eventStore.getGroupMember(
        platform,
        botId,
        params.GuildId ?? defaultGuildId,
        params.UserId ?? defaultUserId
      ),

    /**
     * 获取群成员列表（`userId -> 成员`）。
     *
     * @example
     * const members = await store.getGroupMembers();
     * const count = Object.keys(members).length;
     *
     * @remarks
     * - 等价于 `(await getGroup()).members`，返回的是**共享引用**。
     * - 群不存在时返回空对象 `{}`，不返回 null。
     */
    getGroupMembers: async (params: IGetGroupMemberParams = {}) =>
      (await eventStore.getGroup(platform, botId, params.GuildId ?? defaultGuildId))?.members || {},

    /**
     * 写入 / 更新群成员。
     *
     * @example
     * await store.setGroupMember({
     *   value: {
     *     user_id: event.UserId,
     *     username: event.UserName,
     *     avatar: event.UserAvatar,
     *     role: event.Role,
     *   },
     * });
     *
     * @remarks
     * - 会**合并**已有信息：`username` / `avatar` 用新值覆盖旧值，
     *   `nickname` / `role` 传了才覆盖。
     * - 已有 `avatar` 优先保留，不覆盖。
     * - 首次插入且没传 `avatar` 时，用 `makeUserAvatarUrl` 兜底。
     * - 不会立即写库，走 `messageBuffer` 类似的脏标记，定时 flush。
     */
    setGroupMember: (params: ISetGroupMemberParams) =>
      eventStore.setGroupMember(
        platform,
        botId,
        params.GuildId ?? defaultGuildId,
        params.UserId ?? defaultUserId,
        params.value
      ),

    /**
     * 标记成员已退群（软删除，`removed = true`）。
     *
     * @example
     * await store.removeGroupMember({ UserId: 'xxx' });
     *
     * @remarks
     * - 不物理删除，只标 `removed`。
     * - 成员记录还在，`getGroupMember` 仍能查到，但 `removed = true`。
     * - 真正物理删除用 `deleteGroupMember`。
     */
    removeGroupMember: (params: IRemoveGroupMemberParams = {}) =>
      eventStore.removeGroupMember(
        platform,
        botId,
        params.GuildId ?? defaultGuildId,
        params.UserId ?? defaultUserId
      ),

    /**
     * 物理删除群成员。
     *
     * @example
     * await store.deleteGroupMember({ UserId: 'xxx' });
     *
     * @remarks
     * - 从缓存和 db 里彻底删除，之后 `getGroupMember` 返回 null。
     * - 慎用，一般退群用 `removeGroupMember` 就够。
     */
    deleteGroupMember: (params: IDeleteGroupMemberParams = {}) =>
      eventStore.deleteGroupMember(
        platform,
        botId,
        params.GuildId ?? defaultGuildId,
        params.UserId ?? defaultUserId
      ),

    // #endregion

    // #region ---------------- 消息 ----------------

    /**
     * 统一消息查询。
     *
     * ## 范围语义
     *
     * `GuildId` / `UserId` 支持四种形态：
     *
     * | 传值 | 含义 |
     * |---|---|
     * | 不传（undefined） | 用当前事件上下文的值（当前群 / 当前发送者） |
     * | `null` | 显式不限（跨群 / 跨用户） |
     * | `string` | 单个 ID |
     * | `string[]` | 多个 ID（IN 查询，空数组视为不限） |
     *
     * 默认取最小范围（当前群 + 当前用户），避免误查大范围数据。
     *
     * @example
     * // 当前群内当前用户前 50 条消息或默认 7 天内消息，可传`limit`/`since`/`until`参数调整获取消息数量
     * await store.getMessages();
     *
     * // 当前群所有人的消息
     * await store.getMessages({ UserId: null });
     *
     * // 当前用户在所有群的消息（含私聊）
     * await store.getMessages({ GuildId: null });
     *
     * // 指定群 + 指定用户
     * await store.getMessages({ GuildId: 'xxx', UserId: 'yyy' });
     *
     * // 获取当前用户在多个群的消息，如果需要多个群全部消息，则需显式传`UserId`的值为`null`
     * await store.getMessages({ GuildId: ['g1', 'g2', 'g3'] });
     *
     * // 获取当前群多个用户的消息，如果需要在全部群查找，则需显式传`UserId`的值为`null`
     * await store.getMessages({ UserId: ['u1', 'u2'] });
     *
     * // 获取当前群当前用户 @ 过 xxxUserId的所有消息
     * await store.getMessages({ mention: 'xxxUserId' });
     *
     * // 获取当前群中所有 @ 过当前用户的消息
     * await store.getMessages({ mention: event.current.UserId, UserId: null });
     *
     * // 全服所有消息（慎用，大表慢）
     * await store.getMessages({ GuildId: null, UserId: null });
     *
     * @remarks
     * - 默认不含已撤销消息，要包含传 `includeRemoved: true`。
     * - `keyword` / `mention` 用 `LIKE` 匹配，无法走索引，大表慎用。
     * - 私聊事件下，不传 `GuildId` 默认查私聊消息（`group_id = ''`）。
     */
    getMessages: (params: IGetMessagesParams = {}) =>
      eventStore.getMessages(
        platform,
        botId,
        {
          groupId: resolveScope(params.groupId || params.GuildId, defaultGuildId),
          userId: resolveScope(params.userId || params.UserId, defaultUserId),
          keyword: params.keyword,
          mention: params.mention,
          onlyAtMe: params.onlyAtMe,
          onlyPrivate: params.onlyPrivate,
          since: params.since,
          until: params.until,
          includeRemoved: params.includeRemoved,
        },
        {
          limit: params.limit,
          offset: params.offset,
          order: params.order,
        }
      ),

    /**
     * 按 MessageId 查单条消息。
     *
     * @example
     * const msg = await store.getMessageById({ MessageId: event.MessageId });
     *
     * @remarks
     * - 默认**包含已撤销消息**，因为按 ID 查通常是“我想看原始内容”。
     * - 消息不存在返回 null。
     */
    getMessageById: (params: IGetMessageByIdParams) =>
      eventStore.getMessageById(platform, botId, params.MessageId),

    // #endregion

    // #region ---------------- 统计 ----------------

    /**
     * 统一消息统计，条件与 `getMessages` 一致。
     *
     * @example
     * const count = await store.countMessages({
     *   since: Date.now() - 24 * 3600 * 1000,
     * });
     *
     * @remarks
     * - 条件同 `getMessages`，但不支持 `limit` / `offset` / `order`。
     * - 默认不含已撤销消息。
     */
    countMessages: (params: ICountMessagesParams = {}) =>
      eventStore.countMessages(platform, botId, {
        groupId: resolveScope(params.groupId || params.GuildId, defaultGuildId),
        userId: resolveScope(params.userId || params.UserId, defaultUserId),
        keyword: params.keyword,
        mention: params.mention,
        onlyAtMe: params.onlyAtMe,
        onlyPrivate: params.onlyPrivate,
        since: params.since,
        until: params.until,
        includeRemoved: params.includeRemoved,
      }),

    /**
     * 统计群内活跃用户数（指定时间范围内发过消息的去重用户数）。
     *
     * @example
     * const active = await store.countActiveUsers({
     *   since: Date.now() - 24 * 3600 * 1000,
     * });
     *
     * @remarks
     * - `since` 必传，`until` 可选。
     * - 只统计 `removed = 0` 的消息。
     */
    countActiveUsers: (params: ICountActiveUsersParams) =>
      eventStore.countActiveUsers(
        platform,
        botId,
        params.GuildId ?? defaultGuildId,
        params.since,
        params.until
      ),

    // #endregion

    // #region ---------------- 撤销 ----------------

    /**
     * 标记单条消息为已撤销（软删除）。
     *
     * @example
     * const ok = await store.removeMessage({ MessageId: event.MessageId });
     *
     * @returns 是否成功标记（false 表示消息不存在或已撤销）
     *
     * @remarks
     * - 直接写库，立即生效，不走 `messageBuffer`。
     * - 撤销后 `getMessages` 默认不返回该消息，除非传 `includeRemoved: true`。
     */
    removeMessage: (params: IRemoveMessageParams) =>
      eventStore.removeMessage(platform, botId, params.MessageId),

    /**
     * 批量标记消息为已撤销。
     *
     * @example
     * const n = await store.removeMessages({ MessageIds: ['a', 'b'] });
     *
     * @returns 实际标记成功的条数
     */
    removeMessages: (params: IRemoveMessagesParams) =>
      eventStore.removeMessages(platform, botId, params.MessageIds),

    // #endregion

    // #region ---------------- 元信息 ----------------

    /**
     * 当前绑定的上下文。方便调试。
     *
     * @example
     * console.log(store.context);
     * // { platform: 'qq-bot', botId: '102146209', GuildId: '...', UserId: '...' }
     */
    context: { platform, botId, GuildId: defaultGuildId, UserId: defaultUserId },

    // #endregion

    // #region ---------------- 工具 ----------------

    /**
     * 把 `Record<string, V>` 转成 `V[]` 的小工具。
     *
     * @example
     * const arr = store.toArray(members);
     *
     * @remarks
     * 纯工具函数，不依赖 store 上下文。可用可不用。
     */
    toArray<V extends object>(map?: Record<string, V>) {
      return Object.values(map || {});
    },

    // #endregion
  };
}

export type UseEventStore = ReturnType<typeof useEventStore>;
