import {
  AccountPatch,
  AuthStatusResp,
  clearToken,
  getToken,
  LoginResp,
  req,
  reqJson,
  setToken,
} from './request';

export { clearToken, getToken, setToken };

export type IsolationMode = 'by-bot' | 'by-platform';

export interface IsolationItem {
  platform: string;
  /** 平台默认策略 */
  mode: IsolationMode;
  /** 用户覆盖，null 表示未覆盖 */
  override: IsolationMode | null;
}

export interface IsolationResp {
  items: IsolationItem[];
}

export interface EventStoreConfig {
  isolation: Record<string, IsolationMode>;
  dataPath: string;
  databaseName: string;
  maxCachedGroups: number;
  maxCachedMessages: number;
  flushInterval: number;
  enableMessageStorage: boolean;
}

export interface WebLoginConfig {
  /** 是否启用登录。false 时所有接口放行，适合内网 / 本地开发 */
  enabled: boolean;
  /** 管理员用户名 */
  username: string;
  /** 管理员密码（明文存本地 config.json，仅适合内网） */
  password: string;
  /** 固定 token。设置后可用它直接登录，不走账密。留空则关闭 token 登录 */
  token: string;
}

export interface WebConfig {
  /** 登录 */
  login: WebLoginConfig;
}

export interface ConfigValue {
  eventStore: EventStoreConfig;
  web: WebConfig;
}
export interface ConfigResp {
  value: ConfigValue;
  defaultValue: ConfigValue;
  needsRestart: boolean;
  restartReasons: string[];
}

export interface Platform {
  platforms: string[];
}
export interface BotList {
  bots: string[];
}
export interface GroupItem {
  group_id: string;
  updated_at: number;
  member_count: number;
  active_count: number;
  message_count: number;
}
export interface GroupListResp {
  total: number;
  page: number;
  size: number;
  items: GroupItem[];
}
export interface MemberItem {
  user_id: string;
  group_nickname: string | null;
  removed: number;
  updated_at: number;
  role: string;
  nickname: string | null;
  username: string;
  avatar: string | null;
}
export interface GroupDetailResp {
  group: { group_id: string; updated_at: number };
  total: number;
  page: number;
  size: number;
  members: MemberItem[];
}
export interface UserItem {
  user_id: string;
  username: string;
  avatar: string;
  updated_at: number;
  group_count: number;
}
export interface UserListResp {
  total: number;
  page: number;
  size: number;
  items: UserItem[];
}
export interface UserDetailResp {
  user: UserItem;
  groups: { group_id: string; removed: number; updated_at: number }[];
}
export interface StatsResp {
  groupCount: number;
  memberCount: number;
  activeMemberCount: number;
  userCount: number;
}

export interface MessageItem {
  message_id: string;
  group_id: string;
  user_id: string;
  timestamp: number;
  text: string;
  mentions: string;
  media: string;
  content: string | null;
  is_private: number;
  is_at_me: number;
  created_at: number;
  username: string;
  avatar: string;
}

export interface MessageListResp {
  total: number;
  page: number;
  size: number;
  items: MessageItem[];
}

// #region --------------登录------------------
export const authApi = {
  status: () => req<AuthStatusResp>('/auth/status'),
  login: (body: { username?: string; password?: string; token?: string }) =>
    reqJson<LoginResp>('/auth/login', 'POST', body),
  logout: () => reqJson<{ ok: true }>('/auth/logout', 'POST'),
  updateAccount: (body: AccountPatch) => reqJson<{ ok: true }>('/auth/account', 'PUT', body),
};
//#endregion

export const api = {
  platforms: () => req<Platform>('/platforms'),
  bots: (platform: string) => req<BotList>(`/platforms/${platform}/bots`),
  groups: (platform: string, botId: string, keyword = '', page = 1, size = 50) =>
    req<GroupListResp>('/groups', {
      platform,
      botId,
      keyword,
      page: String(page),
      size: String(size),
    }),
  groupDetail: (
    platform: string,
    botId: string,
    groupId: string,
    keyword = '',
    page = 1,
    size = 100
  ) =>
    req<GroupDetailResp>(`/groups/${groupId}`, {
      platform,
      botId,
      keyword,
      page: String(page),
      size: String(size),
    }),
  users: (platform: string, botId: string, keyword = '', page = 1, size = 50) =>
    req<UserListResp>('/users', {
      platform,
      botId,
      keyword,
      page: String(page),
      size: String(size),
    }),
  userDetail: (platform: string, botId: string, userId: string) =>
    req<UserDetailResp>(`/users/${userId}`, { platform, botId }),
  stats: (platform: string, botId: string) => req<StatsResp>('/stats', { platform, botId }),

  isolation: () => req<IsolationResp>('/isolation'),
  setIsolation: (platform: string, mode: IsolationMode | null) =>
    reqJson<{ ok: true }>(`/isolation/${platform}`, 'PUT', { mode }),

  groupMessages: (
    platform: string,
    botId: string,
    groupId: string,
    keyword = '',
    page = 1,
    size = 50
  ) =>
    req<MessageListResp>(`/groups/${groupId}/messages`, {
      platform,
      botId,
      keyword,
      page: String(page),
      size: String(size),
    }),

  deleteGroupMessage: (platform: string, botId: string, groupId: string, messageId: string) =>
    reqJson<{ ok: true; changes: number }>(
      `/groups/${groupId}/messages/${encodeURIComponent(messageId)}?platform=${platform}&botId=${botId}`,
      'DELETE'
    ),

  deleteGroupMessages: (platform: string, botId: string, groupId: string) =>
    reqJson<{ ok: true; changes: number }>(
      `/groups/${groupId}/messages?platform=${platform}&botId=${botId}&confirm=yes`,
      'DELETE'
    ),

  userMessages: (
    platform: string,
    botId: string,
    userId: string,
    keyword = '',
    groupId = '',
    page = 1,
    size = 50
  ) =>
    req<MessageListResp>(`/users/${userId}/messages`, {
      platform,
      botId,
      keyword,
      groupId,
      page: String(page),
      size: String(size),
    }),

  deleteUserMessage: (platform: string, botId: string, userId: string, messageId: string) =>
    reqJson<{ ok: true; changes: number }>(
      `/users/${userId}/messages/${encodeURIComponent(messageId)}?platform=${platform}&botId=${botId}`,
      'DELETE'
    ),

  deleteUserMessages: (platform: string, botId: string, userId: string, groupId = '') =>
    reqJson<{ ok: true; changes: number }>(
      `/users/${userId}/messages?platform=${platform}&botId=${botId}&groupId=${groupId}&confirm=yes`,
      'DELETE'
    ),

  config: () => req<ConfigResp>('/config'),

  updateConfig: (patch: Partial<ConfigValue>) => reqJson<ConfigResp>('/config', 'PUT', patch),

  resetConfig: (section: 'eventStore' = 'eventStore') =>
    reqJson<ConfigResp>('/config/reset', 'POST', { section }),
};
