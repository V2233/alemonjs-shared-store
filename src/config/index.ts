import { PLUGIN_DATA_DIR, PLUGIN_NAME } from 'alemonjs-shared-store/vars';
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type IsolationMode = 'by-bot' | 'by-platform';

export interface EventStoreConfig {
  isolation: Record<string, IsolationMode>;
  /**
   * 数据根目录。
   * - 相对路径：相对 `PLUGIN_DATA_DIR`
   * - 绝对路径：原样使用
   * @default 'event-data'
   */
  dataPath: string;
  databaseName: string;
  maxCachedGroups: number;
  maxCachedMessages: number;
  flushInterval: number;
  /**
   * 是否启用消息存储。
   * - `true`：消息写入 `messages` 表
   * - `false`：消息不写库，但群 / 用户 / 成员信息照常记录
   * @default true
   */
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

export interface EventStoreOptions {
  dataPath?: string;
  databaseName?: string;
  maxCachedGroups?: number;
  maxCachedMessages?: number;
  flushInterval?: number;
  enableMessageStorage: boolean;
  isolation?: Record<string, IsolationMode>;
}

type ReloadListener = (value: ConfigValue) => void;

class Config {
  readonly defaultValue: ConfigValue = {
    eventStore: {
      isolation: {
        'qq-bot': 'by-bot',
        'wechat-clawbot': 'by-bot',
        wechat: 'by-bot',
        onebot: 'by-bot',
        milky: 'by-bot',
        discord: 'by-platform',
        kook: 'by-platform',
        telegram: 'by-platform',
      },
      dataPath: 'event-data',
      databaseName: 'event.db',
      maxCachedGroups: 1000,
      maxCachedMessages: 5000,
      flushInterval: 10_000,
      enableMessageStorage: true,
    },
    web: {
      login: {
        enabled: true,
        username: 'admin',
        password: 'admin',
        token: '',
      },
    },
  };

  readonly configPath = join(PLUGIN_DATA_DIR, 'config.json');

  private _value: ConfigValue;

  private _listeners = new Set<ReloadListener>();

  private _watcher?: ReturnType<typeof watch>;

  constructor() {
    this._value = this._load();
    this._bootValue = {
      dataPath: this._value.eventStore.dataPath,
      databaseName: this._value.eventStore.databaseName,
      isolation: { ...this._value.eventStore.isolation },
    };
    this._watch();
  }

  get value(): ConfigValue {
    return this._value;
  }

  get eventStore(): EventStoreConfig {
    return this._value.eventStore;
  }

  get web(): WebConfig {
    return this._value.web;
  }

  get webLogin(): WebLoginConfig {
    return this._value.web.login;
  }

  setWebLogin(login: Partial<WebLoginConfig>): void {
    this.saveValue({
      web: {
        ...this._value.web,
        login: {
          ...this._value.web.login,
          ...login,
        },
      },
    });
  }

  // ---------------- 读写 ----------------

  private _load(): ConfigValue {
    const defaults = this.defaultValue;

    if (!existsSync(this.configPath)) {
      return this._clone(defaults);
    }

    try {
      const raw = JSON.parse(readFileSync(this.configPath, 'utf8')) as Partial<ConfigValue>;
      return this._merge(defaults, raw);
    } catch (e) {
      logger.warn(`[${PLUGIN_NAME}][Config] 解析 ${this.configPath} 失败，使用默认值：`, e);
      return this._clone(defaults);
    }
  }

  private _merge(defaults: ConfigValue, raw: Partial<ConfigValue>): ConfigValue {
    const ds = defaults.eventStore;
    const rs = raw.eventStore;
    const dwl = defaults.web.login;
    const rwl = raw.web?.login;

    return {
      eventStore: {
        dataPath: rs?.dataPath ?? ds.dataPath,
        databaseName: rs?.databaseName ?? ds.databaseName,
        maxCachedGroups: rs?.maxCachedGroups ?? ds.maxCachedGroups,
        maxCachedMessages: rs?.maxCachedMessages ?? ds.maxCachedMessages,
        flushInterval: rs?.flushInterval ?? ds.flushInterval,
        enableMessageStorage: rs?.enableMessageStorage ?? ds.enableMessageStorage,
        isolation: {
          ...ds.isolation,
          ...(rs?.isolation ?? {}),
        },
      },
      web: {
        login: {
          enabled: rwl?.enabled ?? dwl.enabled,
          username: rwl?.username ?? dwl.username,
          password: rwl?.password ?? dwl.password,
          token: rwl?.token ?? dwl.token,
        },
      },
    };
  }

  /** 保存完整配置，传 Partial 时与当前内存值合并 */
  saveValue(value?: Partial<ConfigValue>): void {
    if (value) {
      this._value = this._merge(this._value, value);
    }

    const dir = dirname(this.configPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    try {
      writeFileSync(this.configPath, JSON.stringify(this._value, null, 2), 'utf8');
    } catch (e) {
      logger.error(`[${PLUGIN_NAME}][Config] 写入 ${this.configPath} 失败：`, e);
    }
  }

  /** 重新从磁盘加载，并通知监听者 */
  reload(): void {
    const next = this._load();
    this._value = next;
    for (const listener of this._listeners) {
      try {
        listener(next);
      } catch (e) {
        logger.error(`${PLUGIN_NAME}][Config] reload 监听器执行失败：`, e);
      }
    }
  }

  /** 注册 reload 监听器，返回取消函数 */
  onReload(listener: ReloadListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** 监听配置文件变化，自动 reload */
  private _watch(): void {
    if (this._watcher) return;
    if (!existsSync(this.configPath)) return;

    try {
      this._watcher = watch(this.configPath, { persistent: false }, () => {
        // 文件可能被删/改，稍等再 reload
        setTimeout(() => this.reload(), 100);
      });
    } catch (e) {
      logger.warn(`[${PLUGIN_NAME}][Config] 监听配置文件失败：`, e);
    }
  }

  // ---------------- 单项读写 ----------------

  getIsolation(platform: string): IsolationMode {
    return this._value.eventStore.isolation[platform] ?? 'by-bot';
  }

  setIsolation(platform: string, mode: IsolationMode | null): void {
    const isolation = { ...this._value.eventStore.isolation };
    if (mode === null) {
      delete isolation[platform];
    } else {
      isolation[platform] = mode;
    }
    this.saveValue({ eventStore: { ...this._value.eventStore, isolation } });
  }

  updateEventStore(patch: Partial<EventStoreConfig>): void {
    this.saveValue({
      eventStore: {
        ...this._value.eventStore,
        ...patch,
      },
    });
  }

  toEventStoreOptions(): EventStoreOptions {
    const s = this._value.eventStore;
    return {
      dataPath: s.dataPath,
      databaseName: s.databaseName,
      maxCachedGroups: s.maxCachedGroups,
      maxCachedMessages: s.maxCachedMessages,
      flushInterval: s.flushInterval,
      enableMessageStorage: s.enableMessageStorage,
      isolation: s.isolation,
    };
  }

  /** 当前配置是否与启动时不同（需要重启才能生效） */
  needsRestart(): boolean {
    return this.restartReasons().length > 0;
  }

  /** 返回需要重启的具体原因 */
  restartReasons(): string[] {
    const reasons: string[] = [];
    const s = this._value.eventStore;

    if (s.dataPath !== this._bootValue.dataPath) reasons.push('dataPath 已变更');
    if (s.databaseName !== this._bootValue.databaseName) reasons.push('databaseName 已变更');
    if (!this._shallowEqual(s.isolation, this._bootValue.isolation)) {
      reasons.push('isolation 已变更');
    }
    return reasons;
  }

  /** 启动时锁定的配置（只包含需要重启才生效的字段） */
  private _bootValue: {
    dataPath: string;
    databaseName: string;
    isolation: Record<string, IsolationMode>;
  };

  private _shallowEqual(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  private _clone(v: ConfigValue): ConfigValue {
    return JSON.parse(JSON.stringify(v));
  }
}

export const config = new Config();
