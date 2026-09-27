import { useState } from 'react';

import { authApi, clearToken } from '../api';

interface Props {
  onClose: () => void;
}

export default function AccountDialog({ onClose }: Props) {
  const [oldPassword, setOldPassword] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authApi.updateAccount({
        oldPassword: oldPassword || undefined,
        username: username || undefined,
        password: password || undefined,
        token: token !== '' ? token : undefined,
      });
      setOk(true);
      // 改完账密后当前 session 失效，跳登录
      setTimeout(() => {
        clearToken();
        window.location.href = '/';
      }, 1500);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full border border-[var(--al-input-border)] bg-[var(--al-input-bg)] text-[var(--al-input-text)] rounded px-3 py-2 text-sm';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-[var(--al-card)] border border-[var(--al-border)] rounded-lg p-6 space-y-3"
      >
        <h2 className="text-base font-semibold">修改账密</h2>

        <input
          type="password"
          placeholder="旧密码（token 登录可留空）"
          value={oldPassword}
          onChange={e => setOldPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="新用户名（留空不变）"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="新密码（留空不变）"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="新 Token（留空不变）"
          value={token}
          onChange={e => setToken(e.target.value)}
          className={inputClass}
        />

        {error && (
          <div className="text-sm text-[var(--al-danger)] bg-[var(--al-danger-bg)] border border-[var(--al-danger-border)] rounded px-3 py-2">
            {error}
          </div>
        )}
        {ok && (
          <div className="text-sm text-[var(--al-success)] bg-[var(--al-success-bg)] border border-[var(--al-success-border)] rounded px-3 py-2">
            修改成功，即将重新登录...
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-[var(--al-border)] rounded hover:bg-[var(--al-card-hover)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading || ok}
            className="flex-1 py-2 text-sm rounded bg-[var(--al-button-bg)] text-[var(--al-button-text)] disabled:opacity-40"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
