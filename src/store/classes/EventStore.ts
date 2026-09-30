import type { MessageMediaItem } from 'alemonjs';
import { PLUGIN_DATA_DIR } from 'alemonjs-shared-store/vars';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { LRUCache } from 'lru-cache';
import { isAbsolute, join } from 'path';

import { APP_NAME } from '../../api/getGlobalNs';
import { createThrottle, makeUserAvatarUrl } from '../../utils';
import { getGlobalBetterSqlite3 } from '../singletons';

type DatabaseInstance = import('better-sqlite3').Database;
type Statement = import('better-sqlite3').Statement;

// #region ---------------- 类型 ----------------

export interface IStoreUser {
  /** UserId */
  user_id: string;
  /** 用户名 */
  username: string;
  /** 用户头像 */
  avatar: string;
  /** 更新时间戳 */
  updated_at: number;
}

export interface IStoreGroupMember {
  /** UserId */
  user_id: string;
  /** 用户名（来自 users 表） */
  username: string;
  /** 用户头像 */
  avatar: string;
  /** 群内昵称（群名片） */
  nickname?: string;
  /** 群角色：owner / admin / member 等 */
  role?: string;
  /** 是否已退群 */
  removed?: true;
}

export interface IStoreGroup {
  /** GuildId */
  group_id: string;
  /** 成员列表 */
  members: Record<string, IStoreGroupMember>;
}

export interface IStoreMessage {
  /** MessageId */
  message_id: string;
  /** GuildId，私聊时为空字符串 */
  group_id?: string;
  /** UserId */
  user_id: string;
  /** 时间戳 */
  timestamp: number;
  /** MessageText */
  text: string;
  /** 被 @ 的非机器人 UserId 列表 (MessageMentions) */
  mentions: string[];
  /** alemonjs MessageMedia 数组，原样序列化 */
  media: MessageMediaItem[];
  /** alemonjs MessageContent 摘要，不含 auth_token */
  content: any | null;
  /** 是否私聊 */
  is_private: boolean;
  /** 是否 At 机器人 */
  is_at_me: boolean;
  /** 是否已撤销 */
  removed?: true;
  /** 最后修改时间（撤销时间） */
  updated_at?: number;
}

export interface IGetMessagesFilter {
  /** 限定群（私聊用空字符串） */
  groupId?: string | string[];
  /** 限定用户 */
  userId?: string | string[];
  /**
   * 关键词，匹配 `text` 或 `MessageText`。
   * **注意**：`LIKE '%...%'` 无法走索引，全表扫描。
   * 若未显式传 `since`，默认只查最近 **7 天**，避免全表扫描。
   * 如需更大范围，显式传 `since`。
   */
  keyword?: string;
  /**
   * 被 @ 的 UserId，匹配 `mentions` 或 `MessageMentions`。
   * **注意**：同 `keyword`，未传 `since` 时默认只查最近 7 天。
   */
  mention?: string;
  /** 只查 @ 机器人的消息 */
  onlyAtMe?: boolean;
  /** 只查私聊 */
  onlyPrivate?: boolean;
  /** 起始时间，某时间点的时间戳，比该值大的时间戳的消息会被筛选 */
  since?: number;
  /** 结束时间，某时间点的时间戳，比该值小的时间戳的消息会被筛选 */
  until?: number;
  /** 是否包含已撤销消息，默认 false */
  includeRemoved?: boolean;
}

export interface IGetMessagesOptions {
  limit?: number;
  offset?: number;
  /** 排序方向，默认 desc（最新在前） */
  order?: 'asc' | 'desc';
}

/** 消息查询选项 */
export interface IMessageQueryOptions {
  includeRemoved?: boolean;
  offset?: number;
  since?: number;
  until?: number;
}

/** 统计过滤条件 */
export interface IMessageCountFilter {
  groupId?: string;
  userId?: string;
  since?: number;
  until?: number;
  includeRemoved?: boolean;
}

interface UserRow {
  user_id: string;
  username: string;
  avatar: string;
  updated_at: number;
}

interface GroupRow {
  group_id: string;
  updated_at: number;
}

interface MemberRow {
  group_id: string;
  user_id: string;
  nickname: string | null;
  role: string;
  removed: number;
  updated_at: number;
}

interface MemberWithUserRow extends MemberRow {
  u_username: string | null;
  u_avatar: string | null;
}

interface MessageRow {
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
  removed: number;
  updated_at: number;
  created_at: number;
}

export type IsolationMode = 'by-bot' | 'by-platform';

export interface EventStoreOptions {
  /** 数据库路径，@default './data/alemonjs-shared-store/event-data/' */
  dataPath?: string;
  /** 数据库名 @default 'event.db'' */
  databaseName?: string;
  /** 最大缓存群数（内存窗口）@default 1000 */
  maxCachedGroups?: number;
  /** 消息缓冲区上限（超过则触发 flush）@default 5000 */
  maxCachedMessages?: number;
  /** 刷盘间隔（ms）@default 10000 */
  flushInterval?: number;
  /** 是否存储消息历史 */
  enableMessageStorage?: boolean;
  /** 分库策略 */
  isolation?: Record<string, IsolationMode>;
}

// #endregion

// #region ---------------- 平台默认隔离策略 ----------------

const DEFAULT_ISOLATION: Record<string, IsolationMode> = {
  'qq-bot': 'by-bot',
  'wechat-clawbot': 'by-bot',
  wechat: 'by-bot',
  onebot: 'by-bot',
  milky: 'by-bot',
  discord: 'by-platform',
  kook: 'by-platform',
  telegram: 'by-platform',
};

function resolveIsolation(
  platform: string,
  overrides?: Record<string, IsolationMode>
): IsolationMode {
  return overrides?.[platform] ?? DEFAULT_ISOLATION[platform] ?? 'by-bot';
}

// #endregion

// #region ---------------- 单实例状态 ----------------

interface PendingMessage {
  row: MessageRow;
}

/**
 * 实例级 prepared statement 缓存。
 * 只在实例生命周期内缓存固定 SQL，动态拼接 SQL 不缓存。
 */
interface StmtCache {
  hasGroup?: Statement;
  getGroupRow?: Statement;
  getGroupMembers?: Statement;
  getGroupMemberCount?: Statement;
  getGroupMessageCount?: Statement;
  getGroupMessageCountAll?: Statement;
  getUser?: Statement;
  getMessageById?: Statement;
  getMemberWithUser?: Statement;
  removeMessage?: Statement;
}

interface InstanceState {
  platform: string;
  botId: string;
  key: string;
  db: DatabaseInstance;
  cache: LRUCache<string, IStoreGroup>;
  /** userId -> 用户信息（含群成员合并后的信息） */
  userIndex: Map<string, IStoreGroupMember>;
  /** 消息写缓冲，flush 时批量插入 */
  messageBuffer: PendingMessage[];
  dirtyGroups: Set<string>;
  dirtyUsers: Set<string>;
  dirtyMembers: Map<string, Set<string>>;
  deletedMembers: Map<string, Set<string>>;
  flushTimer: NodeJS.Timeout;
  /** prepared statement 缓存 */
  stmt: StmtCache;
}

/** keyword / mention 搜索的默认时间范围（毫秒） */
const DEFAULT_TEXT_SEARCH_RANGE = 7 * 24 * 3600 * 1000;

// #endregion

export class EventStore {
  private _instances = new Map<string, InstanceState>();
  private _pending = new Map<string, Promise<InstanceState>>();

  private _dataPath: string;
  private _databaseName: string;
  private _maxCachedGroups: number;
  private _maxCachedMessages: number;
  private _flushInterval: number;
  private _enableMessageStorage: boolean;
  private _isolationOverrides?: Record<string, IsolationMode>;

  /** 日志节流 */
  private _throttle = createThrottle(5000);

  constructor(options?: EventStoreOptions) {
    this._dataPath = options?.dataPath ?? join(PLUGIN_DATA_DIR, 'event-data');
    this._databaseName = options?.databaseName ?? 'event.db';
    this._maxCachedGroups = options?.maxCachedGroups ?? 1000;
    this._maxCachedMessages = options?.maxCachedMessages ?? 5000;
    this._flushInterval = options?.flushInterval ?? 10 * 1000;
    this._enableMessageStorage = options?.enableMessageStorage ?? true;
    this._isolationOverrides = options?.isolation;
  }

  updateConfig(options?: EventStoreOptions) {
    this._dataPath = options?.dataPath ?? join(PLUGIN_DATA_DIR, 'event-data');
    this._databaseName = options?.databaseName ?? 'event.db';
    this._maxCachedGroups = options?.maxCachedGroups ?? 1000;
    this._maxCachedMessages = options?.maxCachedMessages ?? 5000;
    this._flushInterval = options?.flushInterval ?? 10 * 1000;
    this._enableMessageStorage = options?.enableMessageStorage ?? true;
    this._isolationOverrides = options?.isolation;
  }

  /** 解析 dataPath：相对路径基于 PLUGIN_DATA_DIR，绝对路径原样 */
  private get _resolvedDataPath(): string {
    return isAbsolute(this._dataPath) ? this._dataPath : join(PLUGIN_DATA_DIR, this._dataPath);
  }

  // #region ---------------- 实例管理 ----------------

  private instanceKey(platform: string, botId: string): string {
    const mode = resolveIsolation(platform, this._isolationOverrides);
    if (mode === 'by-platform') return `${platform}:shared`;
    return `${platform}:${botId}`;
  }

  private async ensureInstance(platform: string, botId: string): Promise<InstanceState> {
    const key = this.instanceKey(platform, botId);
    const existing = this._instances.get(key);
    if (existing) return existing;

    const pending = this._pending.get(key);
    if (pending) return pending;

    const promise = this._doEnsureInstance(platform, botId, key).finally(() => {
      this._pending.delete(key);
    });
    this._pending.set(key, promise);
    return promise;
  }

  private async _doEnsureInstance(
    platform: string,
    botId: string,
    key: string
  ): Promise<InstanceState> {
    const existing = this._instances.get(key);
    if (existing) return existing;

    const Database = await getGlobalBetterSqlite3();

    const platformDir = join(this._resolvedDataPath, platform);
    const scopeDir = join(platformDir, key.split(':')[1]);
    if (!existsSync(scopeDir)) mkdirSync(scopeDir, { recursive: true });

    const dbPath = join(scopeDir, this._databaseName);
    const db = new Database(dbPath) as DatabaseInstance;
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 3000');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id    TEXT PRIMARY KEY,
        username   TEXT NOT NULL DEFAULT '',
        avatar     TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS groups (
        group_id   TEXT PRIMARY KEY,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS members (
        group_id   TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        nickname   TEXT,
        role       TEXT NOT NULL DEFAULT '',
        removed    INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        message_id   TEXT PRIMARY KEY,
        group_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        timestamp    INTEGER NOT NULL,
        text         TEXT NOT NULL DEFAULT '',
        mentions     TEXT NOT NULL DEFAULT '[]',
        media        TEXT NOT NULL DEFAULT '[]',
        content      TEXT,
        is_private   INTEGER NOT NULL DEFAULT 0,
        is_at_me     INTEGER NOT NULL DEFAULT 0,
        removed      INTEGER NOT NULL DEFAULT 0,
        updated_at   INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
      CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE INDEX IF NOT EXISTS idx_messages_group_time
        ON messages(group_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_user_time
        ON messages(user_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_group_removed_time
        ON messages(group_id, removed, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_user_removed_time
        ON messages(user_id, removed, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_group_at_me_time
        ON messages(group_id, is_at_me, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_group_private_time
        ON messages(group_id, is_private, timestamp DESC);
    `);

    // 迁移：为老库补 updated_at 列
    const messageCols = db.prepare(`PRAGMA table_info(messages)`).all() as { name: string }[];
    const colNames = new Set(messageCols.map(c => c.name));
    if (!colNames.has('updated_at')) {
      db.exec(`ALTER TABLE messages ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`);
      db.exec(`UPDATE messages SET updated_at = created_at WHERE updated_at = 0`);
    }

    const cache = new LRUCache<string, IStoreGroup>({
      max: this._maxCachedGroups,
      dispose: (group, groupId) => {
        if (this._hasDirty(key, groupId)) this._flushGroupSync(key, group);
      },
    });

    const timer = setInterval(() => this.flushInstance(key), this._flushInterval);
    timer.unref?.();

    const inst: InstanceState = {
      platform,
      botId,
      key,
      db,
      cache,
      userIndex: new Map<string, IStoreGroupMember>(),
      messageBuffer: [],
      dirtyGroups: new Set(),
      dirtyUsers: new Set(),
      dirtyMembers: new Map(),
      deletedMembers: new Map(),
      flushTimer: timer,
      stmt: {},
    };
    this._instances.set(key, inst);
    return inst;
  }

  async ready(platform: string, botId: string): Promise<void> {
    await this.ensureInstance(platform, botId);
  }

  async warmup(platforms?: string[]): Promise<void> {
    if (!existsSync(this._resolvedDataPath)) return;
    const plats = platforms ?? readdirSync(this._resolvedDataPath);
    for (const platform of plats) {
      const platformDir = join(this._resolvedDataPath, platform);
      if (!existsSync(platformDir)) continue;
      for (const scope of readdirSync(platformDir)) {
        const botId = scope === 'shared' ? 'shared' : scope;
        await this.ensureInstance(platform, botId);
      }
    }
  }

  async getRawDb(
    platform: string,
    botId: string
  ): Promise<{ key: string; db: DatabaseInstance; dbPath: string } | null> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst) return null;
    return {
      key: inst.key,
      db: inst.db,
      dbPath: join(this._resolvedDataPath, platform, inst.key.split(':')[1], this._databaseName),
    };
  }

  listLoadedKeys(): { platform: string; botId: string; key: string }[] {
    return [...this._instances.values()].map(i => ({
      platform: i.platform,
      botId: i.botId,
      key: i.key,
    }));
  }

  // #endregion

  // #region ---------------- 群 ----------------

  async getGroup(platform: string, botId: string, groupId: string): Promise<IStoreGroup | null> {
    const inst = await this.ensureInstance(platform, botId);
    return this._getGroupFromInstance(inst, groupId);
  }

  async hasGroup(platform: string, botId: string, groupId: string): Promise<boolean> {
    const inst = await this.ensureInstance(platform, botId);
    if (inst.cache.has(groupId)) return true;
    if (!inst.stmt.hasGroup) {
      inst.stmt.hasGroup = inst.db.prepare('SELECT group_id FROM groups WHERE group_id = ?');
    }
    const row = inst.stmt.hasGroup.get(groupId) as GroupRow | undefined;
    return !!row;
  }

  async getAllGroupIds(platform: string, botId: string): Promise<string[]> {
    const inst = await this.ensureInstance(platform, botId);
    const rows = inst.db.prepare<[], { group_id: string }>('SELECT group_id FROM groups').all();
    return rows.map(r => r.group_id);
  }

  async getGroupMemberCount(platform: string, botId: string, groupId: string): Promise<number> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.stmt.getGroupMemberCount) {
      inst.stmt.getGroupMemberCount = inst.db.prepare(
        'SELECT COUNT(*) AS count FROM members WHERE group_id = ? AND removed = 0'
      );
    }
    const row = inst.stmt.getGroupMemberCount.get(groupId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  async getGroupMessageCount(
    platform: string,
    botId: string,
    groupId: string,
    includeRemoved = false
  ): Promise<number> {
    const inst = await this.ensureInstance(platform, botId);
    const stmtKey = includeRemoved ? 'getGroupMessageCountAll' : 'getGroupMessageCount';
    if (!inst.stmt[stmtKey]) {
      const sql = includeRemoved
        ? 'SELECT COUNT(*) AS count FROM messages WHERE group_id = ?'
        : 'SELECT COUNT(*) AS count FROM messages WHERE group_id = ? AND removed = 0';
      inst.stmt[stmtKey] = inst.db.prepare(sql);
    }
    const row = inst.stmt[stmtKey]!.get(groupId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  // #endregion

  // #region ---------------- 用户 ----------------

  async getUser(platform: string, botId: string, userId: string): Promise<IStoreUser | null> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return null;
    if (!inst.stmt.getUser) {
      inst.stmt.getUser = inst.db.prepare(
        `SELECT user_id, username, avatar, updated_at FROM users WHERE user_id = ?`
      );
    }
    const row = inst.stmt.getUser.get(userId) as UserRow | undefined;
    return row ? this.userRowToUser(row) : null;
  }

  async getUsers(
    platform: string,
    botId: string,
    userIds?: string[],
    limit = 100_000
  ): Promise<Record<string, IStoreUser>> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return {};

    // ---- 不传 userIds：查全部（带 limit） ----
    if (!userIds) {
      const rows = inst.db
        .prepare<[number], UserRow>(
          `SELECT user_id, username, avatar, updated_at FROM users LIMIT ?`
        )
        .all(limit);
      const map: Record<string, IStoreUser> = {};
      for (const r of rows) map[r.user_id] = this.userRowToUser(r);
      return map;
    }

    // ---- 传了空数组：返回空对象 ----
    if (userIds.length === 0) return {};

    // ---- 传了 ID 列表：IN 查询 ----
    if (userIds.length > 500) {
      throw new Error(`[EventStore] userIds 超过 500 个，请分批查询`);
    }

    const placeholders = userIds.map(() => '?').join(',');
    const rows = inst.db
      .prepare<unknown[], UserRow>(
        `SELECT user_id, username, avatar, updated_at FROM users WHERE user_id IN (${placeholders})`
      )
      .all(...userIds);

    const map: Record<string, IStoreUser> = {};
    for (const r of rows) map[r.user_id] = this.userRowToUser(r);
    return map;
  }

  async setUser(platform: string, botId: string, user: IStoreUser): Promise<void> {
    const inst = await this.ensureInstance(platform, botId);
    inst.userIndex.set(user.user_id, {
      user_id: user.user_id,
      username: user.username,
      avatar: user.avatar,
    });
    inst.dirtyUsers.add(user.user_id);
  }

  // #endregion

  // #region ---------------- 成员 ----------------

  async findMember(
    platform: string,
    botId: string,
    userId: string,
    groupId?: string
  ): Promise<IStoreGroupMember | null> {
    const inst = await this.ensureInstance(platform, botId);

    if (groupId) {
      const cached = inst.cache.get(groupId);
      if (cached) {
        const m = cached.members[userId];
        return m ?? null;
      }

      if (!inst.stmt.getMemberWithUser) {
        inst.stmt.getMemberWithUser = inst.db.prepare(
          `SELECT m.group_id, m.user_id, m.nickname, m.role, m.removed, m.updated_at,
                  u.username AS u_username,
                  u.avatar   AS u_avatar
           FROM members m
           LEFT JOIN users u ON u.user_id = m.user_id
           WHERE m.group_id = ? AND m.user_id = ?`
        );
      }
      const row = inst.stmt.getMemberWithUser.get(groupId, userId) as MemberWithUserRow | undefined;

      if (!row) return null;
      return this.rowToMember(row);
    }

    const local = this._findUserInInstance(inst, userId);
    if (local) return local;

    for (const other of this._instances.values()) {
      if (other.platform !== platform || other.key === inst.key) continue;
      const found = this._findUserInInstance(other, userId);
      if (found) return found;
    }

    return null;
  }

  async getGroupMember(
    platform: string,
    botId: string,
    groupId: string,
    userId: string
  ): Promise<IStoreGroupMember | null> {
    const inst = await this.ensureInstance(platform, botId);

    const group = this._getGroupFromInstance(inst, groupId);
    const local = group?.members[userId];
    if (local) return local;

    const mode = resolveIsolation(platform, this._isolationOverrides);
    if (mode === 'by-bot') {
      for (const other of this._instances.values()) {
        if (other.platform !== platform || other.key === inst.key) continue;
        const g = this._getGroupFromInstance(other, groupId);
        const m = g?.members[userId];
        if (m) return m;
      }
    }
    return null;
  }

  // #endregion

  // #region ---------------- 消息读取 ----------------

  private buildMessageFilter(filter?: IGetMessagesFilter): { conds: string[]; args: any[] } {
    const conds: string[] = [];
    const args: any[] = [];

    // groupId
    if (filter?.groupId !== undefined) {
      if (Array.isArray(filter.groupId)) {
        if (filter.groupId.length > 0) {
          const placeholders = filter.groupId.map(() => '?').join(',');
          conds.push(`group_id IN (${placeholders})`);
          args.push(...filter.groupId);
        }
      } else {
        conds.push('group_id = ?');
        args.push(filter.groupId);
      }
    }

    // userId
    if (filter?.userId !== undefined) {
      if (Array.isArray(filter.userId)) {
        if (filter.userId.length > 0) {
          const placeholders = filter.userId.map(() => '?').join(',');
          conds.push(`user_id IN (${placeholders})`);
          args.push(...filter.userId);
        }
      } else {
        conds.push('user_id = ?');
        args.push(filter.userId);
      }
    }

    // keyword / mention：LIKE 无法走索引，强制时间范围
    const hasTextSearch = !!(filter?.keyword || filter?.mention);
    const effectiveSince =
      filter?.since ?? (hasTextSearch ? Date.now() - DEFAULT_TEXT_SEARCH_RANGE : undefined);

    if (filter?.keyword) {
      conds.push("text LIKE ? ESCAPE '\\'");
      args.push(`%${this.escapeLike(filter.keyword)}%`);
    }
    if (filter?.mention) {
      conds.push("mentions LIKE ? ESCAPE '\\'");
      args.push(`%${this.escapeLike(filter.mention)}%`);
    }
    if (filter?.onlyAtMe) {
      conds.push('is_at_me = 1');
    }
    if (filter?.onlyPrivate) {
      conds.push('is_private = 1');
    }
    if (filter?.since) {
      conds.push('timestamp >= ?');
      args.push(effectiveSince);
    }
    if (filter?.until) {
      conds.push('timestamp <= ?');
      args.push(filter.until);
    }
    if (!filter?.includeRemoved) {
      conds.push('removed = 0');
    }

    return { conds, args };
  }

  async getMessages(
    platform: string,
    botId: string,
    filter?: IGetMessagesFilter,
    options?: IGetMessagesOptions
  ): Promise<IStoreMessage[]> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return [];

    const { conds, args } = this.buildMessageFilter(filter);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const order = options?.order === 'asc' ? 'ASC' : 'DESC';
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    args.push(limit, offset);

    const rows = inst.db
      .prepare<unknown[], MessageRow>(
        `SELECT message_id, group_id, user_id, timestamp, text, mentions, media, content,
              is_private, is_at_me, removed, updated_at, created_at
       FROM messages
       ${where}
       ORDER BY timestamp ${order}
       LIMIT ? OFFSET ?`
      )
      .all(...args);

    return rows.map(r => this.rowToMessage(r));
  }

  async countMessages(
    platform: string,
    botId: string,
    filter?: IGetMessagesFilter
  ): Promise<number> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return 0;

    const { conds, args } = this.buildMessageFilter(filter);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const row = inst.db
      .prepare<unknown[], { c: number }>(`SELECT COUNT(*) AS c FROM messages ${where}`)
      .get(...args);
    return row?.c ?? 0;
  }

  /** 按 message_id 查单条（默认包含撤销） */
  async getMessageById(
    platform: string,
    botId: string,
    messageId: string
  ): Promise<IStoreMessage | null> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return null;

    if (!inst.stmt.getMessageById) {
      inst.stmt.getMessageById = inst.db.prepare(
        `SELECT message_id, group_id, user_id, timestamp, text, mentions, media, content,
              is_private, is_at_me, removed, updated_at, created_at
       FROM messages
       WHERE message_id = ?`
      );
    }
    const row = inst.stmt.getMessageById.get(messageId) as MessageRow | undefined;

    return row ? this.rowToMessage(row) : null;
  }

  // #endregion

  // #region ---------------- 消息统计 ----------------

  async countActiveUsers(
    platform: string,
    botId: string,
    groupId: string,
    since: number,
    until?: number
  ): Promise<number> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return 0;

    const args: any[] = [groupId, since];
    let sql = `SELECT COUNT(DISTINCT user_id) AS c FROM messages
               WHERE group_id = ? AND timestamp >= ? AND removed = 0`;
    if (until) {
      sql += ' AND timestamp <= ?';
      args.push(until);
    }
    const row = inst.db.prepare<unknown[], { c: number }>(sql).get(...args);
    return row?.c ?? 0;
  }

  // #endregion

  // #region ---------------- 写入 ----------------

  async setGroup(
    platform: string,
    botId: string,
    groupId: string,
    value: IStoreGroup
  ): Promise<void> {
    const inst = await this.ensureInstance(platform, botId);
    inst.cache.set(groupId, value);
    inst.dirtyGroups.add(groupId);
  }

  async ensureGroup(platform: string, botId: string, groupId: string): Promise<IStoreGroup> {
    if (!groupId) {
      logger.warn(`[${APP_NAME}][EventStore] ensureGroup: groupId 不能为空`);
    }
    const inst = await this.ensureInstance(platform, botId);
    const cached = inst.cache.get(groupId);
    if (cached) return cached;

    const loaded = this._getGroupFromInstance(inst, groupId);
    if (loaded) return loaded;

    const group: IStoreGroup = { group_id: groupId, members: {} };
    inst.cache.set(groupId, group);
    inst.dirtyGroups.add(groupId);
    return group;
  }

  async setGroupMember(
    platform: string,
    botId: string,
    groupId: string,
    userId: string,
    member: IStoreGroupMember
  ): Promise<void> {
    const inst = await this.ensureInstance(platform, botId);

    // groupId 为空：只写 users 表，不碰 members
    if (!groupId) {
      const existing = inst.userIndex.get(userId);
      const merged: IStoreGroupMember = existing
        ? {
            ...existing,
            ...member,
            username: member.username || existing.username,
            avatar: existing.avatar || member.avatar,
          }
        : {
            ...member,
            avatar: member.avatar || makeUserAvatarUrl(userId, botId, platform),
          };
      inst.userIndex.set(userId, merged);
      inst.dirtyUsers.add(userId);
      return;
    }

    // 正常群成员逻辑
    const group = await this.ensureGroup(platform, botId, groupId);

    const existing = group.members[userId];
    const merged: IStoreGroupMember = existing
      ? {
          ...existing,
          ...member,
          username: member.username || existing.username,
          avatar: existing.avatar || member.avatar,
          nickname: member.nickname ?? existing.nickname,
          role: member.role ?? existing.role,
        }
      : {
          ...member,
          avatar: member.avatar || makeUserAvatarUrl(userId, botId, platform),
        };

    group.members[userId] = merged;
    inst.userIndex.set(userId, merged);
    inst.dirtyUsers.add(userId);

    let set = inst.dirtyMembers.get(groupId);
    if (!set) {
      set = new Set();
      inst.dirtyMembers.set(groupId, set);
    }
    set.add(userId);
    inst.deletedMembers.get(groupId)?.delete(userId);
  }

  async removeGroupMember(
    platform: string,
    botId: string,
    groupId: string,
    userId: string
  ): Promise<void> {
    const inst = await this.ensureInstance(platform, botId);
    const group = inst.cache.get(groupId) ?? this._getGroupFromInstance(inst, groupId);
    const m = group?.members[userId];
    if (!m) return;
    m.removed = true;
    await this.setGroupMember(platform, botId, groupId, userId, m);
  }

  async deleteGroupMember(
    platform: string,
    botId: string,
    groupId: string,
    userId: string
  ): Promise<void> {
    const inst = await this.ensureInstance(platform, botId);
    const group = inst.cache.get(groupId);
    if (group?.members[userId]) delete group.members[userId];

    let set = inst.deletedMembers.get(groupId);
    if (!set) {
      set = new Set();
      inst.deletedMembers.set(groupId, set);
    }
    set.add(userId);
    inst.dirtyMembers.get(groupId)?.delete(userId);
  }

  async appendMessage(platform: string, botId: string, msg: IStoreMessage): Promise<void> {
    // 未启用则不添加
    if (!this._enableMessageStorage) return;
    const inst = await this.ensureInstance(platform, botId);

    // 缓冲区硬上限：超过两倍，先 flush，再不行就丢弃最老的
    if (inst.messageBuffer.length >= this._maxCachedMessages * 2) {
      this._throttle(`overflow:${inst.key}`, () => {
        logger.warn(
          `[${APP_NAME}][EventStore] messageBuffer 超过 ${this._maxCachedMessages * 2}，强制 flush`
        );
      });
      this.flushInstance(inst.key);
      if (inst.messageBuffer.length >= this._maxCachedMessages * 2) {
        inst.messageBuffer.splice(0, inst.messageBuffer.length - this._maxCachedMessages);
      }
    }

    inst.messageBuffer.push({
      row: {
        message_id: msg.message_id,
        group_id: msg.group_id || '',
        user_id: msg.user_id,
        timestamp: msg.timestamp,
        text: msg.text,
        mentions: JSON.stringify(msg.mentions ?? []),
        media: JSON.stringify(msg.media ?? []),
        content: msg.content ? JSON.stringify(msg.content) : null,
        is_private: msg.is_private ? 1 : 0,
        is_at_me: msg.is_at_me ? 1 : 0,
        removed: 0,
        updated_at: 0,
        created_at: Date.now(),
      },
    });

    if (inst.messageBuffer.length >= this._maxCachedMessages) {
      this.flushInstance(inst.key);
    }
  }

  /**
   * 标记消息为已撤销（软删除）。
   * 不走 messageBuffer，直接写库，保证立即生效。
   * @returns 是否成功标记（false 表示消息不存在或已是撤销状态）
   */
  async removeMessage(platform: string, botId: string, messageId: string): Promise<boolean> {
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return false;

    const now = Date.now();
    if (!inst.stmt.removeMessage) {
      inst.stmt.removeMessage = inst.db.prepare(
        `UPDATE messages SET removed = 1, updated_at = ?
         WHERE message_id = ? AND removed = 0`
      );
    }
    const result = inst.stmt.removeMessage.run(now, messageId);

    return result.changes > 0;
  }

  async removeMessages(platform: string, botId: string, messageIds: string[]): Promise<number> {
    if (messageIds.length === 0) return 0;
    const inst = await this.ensureInstance(platform, botId);
    if (!inst.db.open) return 0;

    const now = Date.now();
    const stmt = inst.db.prepare(
      `UPDATE messages SET removed = 1, updated_at = ?
       WHERE message_id = ? AND removed = 0`
    );

    const tx = inst.db.transaction((ids: string[]) => {
      let count = 0;
      for (const id of ids) {
        const r = stmt.run(now, id);
        count += r.changes;
      }
      return count;
    });

    return tx(messageIds);
  }

  // #endregion

  // #region ---------------- flush ----------------

  flushInstance(key: string): void {
    const inst = this._instances.get(key);
    if (!inst) return;
    if (!inst.db.open) return;

    const dirtyGroupIds = new Set<string>([
      ...inst.dirtyGroups,
      ...inst.dirtyMembers.keys(),
      ...inst.deletedMembers.keys(),
    ]);

    const hasUserDirty = inst.dirtyUsers.size > 0;
    const hasMessageBuffer = inst.messageBuffer.length > 0;

    if (dirtyGroupIds.size === 0 && !hasUserDirty && !hasMessageBuffer) return;

    const upsertGroup = inst.db.prepare(`
      INSERT INTO groups (group_id, updated_at) VALUES (?, ?)
      ON CONFLICT(group_id) DO UPDATE SET updated_at = excluded.updated_at
    `);

    const upsertUser = inst.db.prepare(`
      INSERT INTO users (user_id, username, avatar, updated_at)
      VALUES (@user_id, @username, @avatar, @updated_at)
      ON CONFLICT(user_id) DO UPDATE SET
        username   = excluded.username,
        avatar     = excluded.avatar,
        updated_at = excluded.updated_at
    `);

    const upsertMember = inst.db.prepare(`
      INSERT INTO members (group_id, user_id, nickname, role, removed, updated_at)
      VALUES (@group_id, @user_id, @nickname, @role, @removed, @updated_at)
      ON CONFLICT(group_id, user_id) DO UPDATE SET
        nickname   = excluded.nickname,
        role       = excluded.role,
        removed    = excluded.removed,
        updated_at = excluded.updated_at
    `);

    const deleteMember = inst.db.prepare('DELETE FROM members WHERE group_id = ? AND user_id = ?');

    const insertMessage = inst.db.prepare(`
      INSERT OR IGNORE INTO messages
        (message_id, group_id, user_id, timestamp, text, mentions, media, content,
         is_private, is_at_me, removed, updated_at, created_at)
      VALUES
        (@message_id, @group_id, @user_id, @timestamp, @text, @mentions, @media, @content,
         @is_private, @is_at_me, @removed, @updated_at, @created_at)
    `);

    const now = Date.now();

    const tx = inst.db.transaction(() => {
      // 1) users
      for (const uid of inst.dirtyUsers) {
        const u = this._getUserFromIndex(inst, uid);
        if (!u) continue;
        upsertUser.run({
          user_id: uid,
          username: u.username ?? '',
          avatar: u.avatar ?? '',
          updated_at: now,
        });
      }

      // 2) groups + members
      for (const gid of dirtyGroupIds) {
        upsertGroup.run(gid, now);

        const del = inst.deletedMembers.get(gid);
        if (del) for (const uid of del) deleteMember.run(gid, uid);

        const ups = inst.dirtyMembers.get(gid);
        if (ups) {
          const group = inst.cache.get(gid);
          if (group) {
            for (const uid of ups) {
              const m = group.members[uid];
              if (!m) continue;
              upsertMember.run({
                group_id: gid,
                user_id: uid,
                nickname: m.nickname ?? null,
                role: m.role ?? '',
                removed: m.removed ? 1 : 0,
                updated_at: now,
              });
            }
          }
        }
      }

      // 3) messages
      for (const { row } of inst.messageBuffer) {
        insertMessage.run(row);
      }
    });

    try {
      tx();
      inst.dirtyGroups.clear();
      inst.dirtyUsers.clear();
      inst.dirtyMembers.clear();
      inst.deletedMembers.clear();
      inst.messageBuffer.length = 0;
    } catch (e) {
      this._throttle(`flush-fail:${key}`, () => {
        logger.error(`[${APP_NAME}][EventStore] flush 失败 (${key})：`, e);
      });
    }
  }

  flush(): void {
    for (const key of this._instances.keys()) this.flushInstance(key);
  }

  private _hasDirty(instKey: string, groupId: string): boolean {
    const inst = this._instances.get(instKey);
    if (!inst) return false;
    return (
      inst.dirtyGroups.has(groupId) ||
      inst.dirtyMembers.has(groupId) ||
      inst.deletedMembers.has(groupId)
    );
  }

  /** LRU 淘汰时同步落单个群（不含消息，消息走 messageBuffer） */
  private _flushGroupSync(instKey: string, group: IStoreGroup): void {
    const inst = this._instances.get(instKey);
    if (!inst) return;
    if (!inst.db.open) return;
    const now = Date.now();
    try {
      const upsertUser = inst.db.prepare(`
        INSERT INTO users (user_id, username, avatar, updated_at)
        VALUES (@user_id, @username, @avatar, @updated_at)
        ON CONFLICT(user_id) DO UPDATE SET
          username=excluded.username, avatar=excluded.avatar,
          updated_at=excluded.updated_at
      `);
      const upsertGroup = inst.db.prepare(`
        INSERT INTO groups (group_id, updated_at) VALUES (?, ?)
        ON CONFLICT(group_id) DO UPDATE SET updated_at = excluded.updated_at
      `);
      const upsertMember = inst.db.prepare(`
        INSERT INTO members (group_id, user_id, nickname, role, removed, updated_at)
        VALUES (@group_id, @user_id, @nickname, @role, @removed, @updated_at)
        ON CONFLICT(group_id, user_id) DO UPDATE SET
          nickname=excluded.nickname, role=excluded.role,
          removed=excluded.removed, updated_at=excluded.updated_at
      `);

      const tx = inst.db.transaction(() => {
        upsertGroup.run(group.group_id, now);
        for (const uid of Object.keys(group.members)) {
          const m = group.members[uid];
          upsertUser.run({
            user_id: uid,
            username: m.username ?? '',
            avatar: m.avatar ?? '',
            updated_at: now,
          });
          upsertMember.run({
            group_id: group.group_id,
            user_id: uid,
            nickname: m.nickname ?? null,
            role: m.role ?? '',
            removed: m.removed ? 1 : 0,
            updated_at: now,
          });
        }
      });
      tx();
      inst.dirtyGroups.delete(group.group_id);
      inst.dirtyMembers.delete(group.group_id);
      inst.deletedMembers.delete(group.group_id);
    } catch (e) {
      this._throttle(`dispose-fail:${instKey}`, () => {
        logger.error(`[${APP_NAME}][EventStore] dispose flush 失败 (${instKey})：`, e);
      });
    }
  }

  // #endregion

  // #region ---------------- 内部工具 ----------------

  private _getGroupFromInstance(inst: InstanceState, groupId: string): IStoreGroup | null {
    const cached = inst.cache.get(groupId);
    if (cached) return cached;

    if (!inst.db.open) return null;

    if (!inst.stmt.getGroupRow) {
      inst.stmt.getGroupRow = inst.db.prepare('SELECT group_id FROM groups WHERE group_id = ?');
    }
    const groupRow = inst.stmt.getGroupRow.get(groupId) as GroupRow | undefined;
    if (!groupRow) return null;

    if (!inst.stmt.getGroupMembers) {
      inst.stmt.getGroupMembers = inst.db.prepare(
        `SELECT m.group_id, m.user_id, m.nickname, m.role, m.removed, m.updated_at,
                u.username AS u_username,
                u.avatar   AS u_avatar
         FROM members m
         LEFT JOIN users u ON u.user_id = m.user_id
         WHERE m.group_id = ?`
      );
    }
    const rows = inst.stmt.getGroupMembers.all(groupId) as MemberWithUserRow[];

    const group: IStoreGroup = { group_id: groupId, members: {} };
    for (const row of rows) {
      const m = this.rowToMember(row);
      group.members[row.user_id] = m;
      inst.userIndex.set(row.user_id, m);
    }
    inst.cache.set(groupId, group);
    return group;
  }

  private _getUserFromIndex(inst: InstanceState, userId: string): IStoreGroupMember | null {
    return inst.userIndex.get(userId) ?? null;
  }

  private _findUserInInstance(inst: InstanceState, userId: string): IStoreGroupMember | null {
    const cached = inst.userIndex.get(userId);
    if (cached) return cached;
    if (!inst.db.open) return null;

    if (!inst.stmt.getUser) {
      inst.stmt.getUser = inst.db.prepare(
        `SELECT user_id, username, avatar, updated_at FROM users WHERE user_id = ?`
      );
    }
    const row = inst.stmt.getUser.get(userId) as UserRow | undefined;
    if (!row) return null;
    const m = this.userRowToMember(row);
    inst.userIndex.set(userId, m);
    return m;
  }

  private rowToMember(row: MemberWithUserRow): IStoreGroupMember {
    const m: IStoreGroupMember = {
      user_id: row.user_id,
      username: row.u_username ?? '',
      avatar: row.u_avatar ?? '',
    };
    if (row.removed) m.removed = true;
    if (row.nickname) m.nickname = row.nickname;
    if (row.role) m.role = row.role;
    return m;
  }

  private userRowToMember(row: UserRow): IStoreGroupMember {
    return {
      user_id: row.user_id,
      username: row.username,
      avatar: row.avatar,
    };
  }

  private userRowToUser(row: UserRow): IStoreUser {
    return {
      user_id: row.user_id,
      username: row.username,
      avatar: row.avatar,
      updated_at: row.updated_at,
    };
  }

  private rowToMessage(row: MessageRow): IStoreMessage {
    return {
      message_id: row.message_id,
      group_id: row.group_id,
      user_id: row.user_id,
      timestamp: row.timestamp,
      text: row.text,
      mentions: this.safeParse<string[]>(row.mentions, []),
      media: this.safeParse<any[]>(row.media, []),
      content: row.content ? this.safeParse<any>(row.content, null) : null,
      is_private: !!row.is_private,
      is_at_me: !!row.is_at_me,
      ...(row.removed ? { removed: true as const } : {}),
      ...(row.updated_at ? { updated_at: row.updated_at } : {}),
    };
  }

  private safeParse<T>(s: string, fallback: T): T {
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  }

  private escapeLike(s: string): string {
    return s.replace(/[\\%_]/g, m => '\\' + m);
  }

  // #endregion

  // #region ---------------- 关闭 ----------------

  close(): void {
    for (const inst of this._instances.values()) {
      clearInterval(inst.flushTimer);
      this.flushInstance(inst.key);
      try {
        inst.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {}
      try {
        inst.db.close();
      } catch (err) {
        // close 时的错误不打折，直接打
        logger.error(`[${APP_NAME}][EventStore] close 失败 (${inst.key})：`, err);
      }
      // 清空 statement 缓存，释放引用
      inst.stmt = {};
    }
    this._instances.clear();
  }

  // #endregion
}
