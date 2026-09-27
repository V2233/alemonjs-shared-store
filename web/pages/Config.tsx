import { useEffect, useState } from 'react';

import {
  api,
  WebLoginConfig,
  type ConfigValue,
  type EventStoreConfig,
  type IsolationMode,
} from '../api';
import Table from '../components/Table';

const MODE_LABEL: Record<IsolationMode, string> = {
  'by-bot': '按 BotId 分库',
  'by-platform': '按平台共享',
};

export default function Config() {
  const [value, setValue] = useState<ConfigValue | null>(null);
  const [defaultValue, setDefaultValue] = useState<ConfigValue | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [restartReasons, setRestartReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单本地状态（提交前不写盘）。含 eventStore + web。
  const [form, setForm] = useState<ConfigValue | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    api
      .config()
      .then(r => {
        setValue(r.value);
        setDefaultValue(r.defaultValue);
        setNeedsRestart(r.needsRestart);
        setRestartReasons(r.restartReasons);
        setForm(JSON.parse(JSON.stringify(r.value)));
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- 表单 patch ----------------

  const patchEventStore = (patch: Partial<EventStoreConfig>) => {
    setForm(prev =>
      prev
        ? {
            ...prev,
            eventStore: { ...prev.eventStore, ...patch },
          }
        : prev
    );
  };

  // const patchWeb = (patch: Partial<WebConfig>) => {
  //   setForm(prev =>
  //     prev
  //       ? {
  //           ...prev,
  //           web: { ...prev.web, ...patch },
  //         }
  //       : prev
  //   );
  // };

  const patchWebLogin = (patch: Partial<WebLoginConfig>) => {
    setForm(prev =>
      prev
        ? {
            ...prev,
            web: {
              ...prev.web,
              login: { ...prev.web.login, ...patch },
            },
          }
        : prev
    );
  };

  const patchIsolation = (platform: string, mode: IsolationMode | null) => {
    if (!form) return;
    const next = { ...form.eventStore.isolation };
    if (mode === null) {
      delete next[platform];
    } else {
      next[platform] = mode;
    }
    patchEventStore({ isolation: next });
  };

  // ---------------- 保存 / 重置 ----------------

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.updateConfig({
        eventStore: form.eventStore,
        web: form.web,
      });
      setValue(r.value);
      setNeedsRestart(r.needsRestart);
      setRestartReasons(r.restartReasons);
      setForm(JSON.parse(JSON.stringify(r.value)));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const resetEventStore = async () => {
    if (!confirm('恢复 EventStore 全部配置为默认值？')) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.resetConfig('eventStore');
      setValue(r.value);
      setNeedsRestart(r.needsRestart);
      setRestartReasons(r.restartReasons);
      setForm(JSON.parse(JSON.stringify(r.value)));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // ---------------- 派生状态 ----------------

  const isDirty = !!form && !!value && JSON.stringify(form) !== JSON.stringify(value);

  // 所有平台（默认 + 覆盖）
  const allPlatforms = (() => {
    const set = new Set<string>();
    for (const p of Object.keys(defaultValue?.eventStore.isolation ?? {})) set.add(p);
    for (const p of Object.keys(form?.eventStore.isolation ?? {})) set.add(p);
    return [...set];
  })();

  if (loading || !form) {
    return <div className="text-sm text-[var(--al-muted)] py-8 text-center">加载中...</div>;
  }

  const es = form.eventStore;
  const web = form.web;

  return (
    <div className="space-y-6">
      {/* 需要重启提示 */}
      {needsRestart && (
        <div className="rounded-lg border border-[var(--al-warning-border)] bg-[var(--al-warning-bg)] text-[var(--al-warning)] px-4 py-3 text-sm">
          <div className="font-medium mb-1">配置已修改，需要重启 alemonjs 才能生效</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {restartReasons.map(r => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--al-danger-border)] bg-[var(--al-danger-bg)] text-[var(--al-danger)] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ---------------- EventStore ---------------- */}
      <section className="bg-[var(--al-card)] border border-[var(--al-border)] rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">EventStore</h2>
          <button
            onClick={resetEventStore}
            disabled={saving}
            className="px-2 py-1 text-xs rounded border border-[var(--al-danger-border)] text-[var(--al-danger)] hover:bg-[var(--al-danger-bg)] disabled:opacity-40"
          >
            恢复默认
          </button>
        </div>

        <Field label="dataPath" hint="数据库根目录。修改后需重启">
          <input
            type="text"
            value={es.dataPath}
            onChange={e => patchEventStore({ dataPath: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="databaseName" hint="数据库文件名。修改后需重启">
          <input
            type="text"
            value={es.databaseName}
            onChange={e => patchEventStore({ databaseName: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="enableMessageStorage" hint="关闭后不再写入新消息，历史消息仍可查询。立即生效">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={es.enableMessageStorage}
              onChange={e => patchEventStore({ enableMessageStorage: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">{es.enableMessageStorage ? '已启用' : '已关闭'}</span>
          </label>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="maxCachedGroups" hint="内存中最大群数量">
            <input
              type="number"
              min={1}
              value={es.maxCachedGroups}
              onChange={e => patchEventStore({ maxCachedGroups: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>

          <Field label="maxCachedMessages" hint="消息缓冲区上限">
            <input
              type="number"
              min={1}
              value={es.maxCachedMessages}
              onChange={e => patchEventStore({ maxCachedMessages: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>

          <Field label="flushInterval" hint="刷盘间隔（ms）">
            <input
              type="number"
              min={1}
              value={es.flushInterval}
              onChange={e => patchEventStore({ flushInterval: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {/* ---------------- 分库策略 ---------------- */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">分库策略</h2>
          <p className="text-sm text-[var(--al-muted)] mt-1">
            按 BotId 分库适合官方 QQ、微信、OneBot 等 ID 与 Bot 绑定的平台； 按平台共享适合
            Discord、KOOK、Telegram 等 ID 平台级唯一的平台。 切换后需重启，且不会自动迁移历史数据。
          </p>
        </div>

        <Table<{ platform: string; effective: IsolationMode; isOverride: boolean }>
          columns={[
            { key: 'platform', title: '平台', className: 'font-mono' },
            {
              key: 'effective',
              title: '当前策略',
              render: r => (
                <span className="text-sm">
                  {MODE_LABEL[r.effective]}
                  {r.isOverride && (
                    <span className="ml-2 text-xs text-[var(--al-warning)]">（已覆盖）</span>
                  )}
                  {!r.isOverride && (
                    <span className="ml-2 text-xs text-[var(--al-muted)]">（默认）</span>
                  )}
                </span>
              ),
            },
            {
              key: 'actions',
              title: '操作',
              render: r => (
                <div className="flex gap-2">
                  <button
                    disabled={r.effective === 'by-bot'}
                    onClick={() => patchIsolation(r.platform, 'by-bot')}
                    className={btnClass}
                  >
                    设为按 BotId
                  </button>
                  <button
                    disabled={r.effective === 'by-platform'}
                    onClick={() => patchIsolation(r.platform, 'by-platform')}
                    className={btnClass}
                  >
                    设为共享
                  </button>
                  <button
                    disabled={!r.isOverride}
                    onClick={() => patchIsolation(r.platform, null)}
                    className={btnClass}
                  >
                    恢复默认
                  </button>
                </div>
              ),
            },
          ]}
          data={allPlatforms.map(platform => {
            const def = defaultValue?.eventStore.isolation[platform] ?? 'by-bot';
            const cur = es.isolation[platform];
            const effective = cur ?? def;
            return {
              platform,
              effective,
              isOverride: cur !== undefined && cur !== def,
            };
          })}
          rowKey={r => r.platform}
        />
      </section>

      {/* ---------------- Web 登录 ---------------- */}
      <section className="bg-[var(--al-card)] border border-[var(--al-border)] rounded-lg p-4 space-y-4">
        <h2 className="text-base font-semibold">Web 登录</h2>

        <Field label="enabled" hint="关闭后所有接口放行，适合内网 / 本地开发。立即生效">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={web.login.enabled}
              onChange={e => patchWebLogin({ enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">{web.login.enabled ? '已启用' : '已关闭'}</span>
          </label>
        </Field>

        <Field label="username">
          <input
            type="text"
            value={web.login.username}
            onChange={e => patchWebLogin({ username: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="password" hint="明文存本地 config.json，生产环境建议走https代理">
          <input
            type="text"
            value={web.login.password}
            onChange={e => patchWebLogin({ password: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="token" hint="留空则关闭 token 登录。设置后可用它直接登录">
          <input
            type="text"
            value={web.login.token}
            onChange={e => patchWebLogin({ token: e.target.value })}
            className={inputClass}
          />
        </Field>
      </section>

      {/* ---------------- 操作栏 ---------------- */}
      <div className="flex items-center gap-3 sticky bottom-4 bg-[var(--al-bg)] py-2">
        <button
          onClick={save}
          disabled={!isDirty || saving}
          className="px-4 py-2 text-sm rounded bg-[var(--al-button-bg)] text-[var(--al-button-text)] disabled:opacity-40"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button onClick={reload} disabled={saving} className={btnClass}>
          放弃修改
        </button>
        {isDirty && <span className="text-xs text-[var(--al-warning)]">有未保存的修改</span>}
      </div>
    </div>
  );
}

// ---------------- 样式 ----------------

const inputClass =
  'w-full border border-[var(--al-input-border)] bg-[var(--al-input-bg)] text-[var(--al-input-text)] placeholder:text-[var(--al-input-placeholder)] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--al-primary-border)]';

const btnClass =
  'px-2 py-1 text-xs border border-[var(--al-border)] rounded hover:bg-[var(--al-card-hover)] disabled:opacity-40';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <div className="text-xs text-[var(--al-muted)]">{hint}</div>}
    </div>
  );
}
