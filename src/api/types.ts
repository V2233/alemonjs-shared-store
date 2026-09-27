// 仅允许类型引用
import type {
  IGetMessagesFilter,
  IStoreGroup,
  IStoreGroupMember,
} from '../store/classes/EventStore';

/**
 * useEventStore 的初始化选项。
 *
 * 默认从 alemonjs 事件上下文自动取 `Platform` / `BotId`。
 * 显式传入可覆盖，用于跨平台调用、调试等场景。
 */
export interface IUseEventStoreOptions {
  /** 显式指定平台，不传则取 event.current.Platform */
  Platform?: string;
  /** 显式指定 BotId，不传则取 event.current.BotId */
  BotId?: string;
}

// ---------------- 参数对象 ----------------

/** `hasGroup` 参数 */
export interface IHasGroupParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
}
/** `ensureGroup` 参数 */
export interface IEnsureGroupParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
}
/** `getGroup` 参数 */
export interface IGetGroupParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
}
/** `setGroup` 参数 */
export interface ISetGroupParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
  /** 要写入的群对象 */
  value: IStoreGroup;
}
/** `getGroupMember` / `getGroupMembers` 参数 */
export interface IGetGroupMemberParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
  /** 用户 ID，默认当前事件的 UserId @default event.current.UserId */
  UserId?: string;
}
/** `setGroupMember` 参数 */
export interface ISetGroupMemberParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
  /** 用户 ID，默认当前事件的 UserId @default event.current.UserId */
  UserId?: string;
  /** 要写入的成员对象 */
  value: IStoreGroupMember;
}
/** `removeGroupMember` 参数 */
export interface IRemoveGroupMemberParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
  /** 用户 ID，默认当前事件的 UserId @default event.current.UserId */
  UserId?: string;
}
/** `deleteGroupMember` 参数 */
export interface IDeleteGroupMemberParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
  /** 用户 ID，默认当前事件的 UserId @default event.current.UserId */
  UserId?: string;
}
/** `findMember` 参数 */
export interface IFindMemberParams {
  /** 用户 ID，默认当前事件的 UserId @default event.current.UserId */
  UserId?: string;
  /**
   * 群号。
   * - 不传：限定在当前群内查找，如果当前不在群，则回退用户表（用户表不含`role`等群员专属字段）
   * - 传`null`：在当前平台的所有已加载实例里全局查找
   * - 传指定群号：在指定群查找
   */
  GuildId?: string | null;
}
/** `getUser` 参数 */
export interface IGetUserParams {
  /** 用户 ID，默认当前事件的 UserId @default event.current.UserId */
  UserId?: string;
}
/** `getUsers` 参数 */
export interface IGetUsersParams {
  /**
   * 用户 ID 列表。
   * - 不传 / `undefined`：返回全部用户（受 `limit` 限制）
   * - `string[]`：返回指定用户，不存在的静默跳过
   * - 空数组 `[]`：返回空对象
   */
  UserIds?: string[];

  /**
   * 返回条数上限。
   * 仅在 `UserIds` 未传时生效。
   * @default 100000
   */
  limit?: number;
}
/** `getMessageById` 参数 */
export interface IGetMessageByIdParams {
  /** 消息 ID */
  MessageId: string;
}
/** `removeMessage` 参数 */
export interface IRemoveMessageParams {
  /** 消息 ID */
  MessageId: string;
}
/** `removeMessages` 参数 */
export interface IRemoveMessagesParams {
  /** 消息 ID 列表 */
  MessageIds: string[];
}
/** `getGroupMessageCount` 参数 */
export interface IGetGroupMessageCountParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
  /** 是否包含已撤销消息，默认 false */
  includeRemoved?: boolean;
}
/** `getGroupMemberCount` 参数 */
export interface IGetGroupMemberCountParams {
  /** 群号，默认当前事件的 GuildId @default event.current.GuildId */
  GuildId?: string;
}
/** `countActiveUsers` 参数 */
export interface ICountActiveUsersParams {
  /** 群号，默认当前事件的 GuildId */
  GuildId?: string;
  /** 起始时间戳（毫秒，含） */
  since: number;
  /** 结束时间戳（毫秒，含），不传则不限 */
  until?: number;
}

/**
 * `getMessages` 参数。
 *
 * 继承 `IGetMessagesFilter` 的所有过滤条件，另外支持：
 * - `GuildId`：等价于 filter.groupId
 * - `UserId`：等价于 filter.userId
 *
 * 若同时传 `GuildId` 和 `groupId`，`groupId` 优先。
 */
export interface IGetMessagesParams extends IGetMessagesFilter {
  /** 返回条数上限，默认 50 */
  limit?: number;
  /** 偏移量，默认 0 */
  offset?: number;
  /** 排序方向，默认 desc（最新在前） */
  order?: 'asc' | 'desc';

  /**
   * 群号，同 filter.groupId
   * 值为`null`时则跨群查找
   * @default event.current.GuildId
   */
  GuildId?: null | string | string[];
  /**
   * 用户号，同 filter.userId
   * 值为`null`时则在本群或所有群查找
   * @default event.current.UserId
   */
  UserId?: null | string | string[];
}

/**
 * `countMessages` 参数。
 *
 * 继承 `IGetMessagesFilter` 的所有过滤条件，另外支持：
 * - `GuildId`：等价于 filter.groupId
 * - `UserId`：等价于 filter.userId
 */
export interface ICountMessagesParams extends IGetMessagesFilter {
  /**
   * 群号，同 filter.groupId
   * 值为`null`时则跨群查找
   * @default event.current.GuildId
   */
  GuildId?: null | string;
  /**
   * 用户号，同 filter.userId
   * 值为`null`时则在本群或所有群查找
   * @default event.current.UserId
   */
  UserId?: null | string;
}
