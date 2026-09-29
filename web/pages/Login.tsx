import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authApi } from '../api';
import { setToken } from '../request';

interface Props {
  onSuccess?: () => void;
}

export default function Login({ onSuccess }: Props) {
  const [mode, setMode] = useState<'account' | 'token'>('account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // 新增
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = mode === 'account' ? { username, password } : { token: token.trim() };
      const r = await authApi.login(body);
      setToken(r.token);
      onSuccess?.(); // 通知 App
      navigate('/groups', { replace: true });
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full border border-[var(--al-input-border)] bg-[var(--al-input-bg)] text-[var(--al-input-text)] placeholder:text-[var(--al-input-placeholder)] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--al-primary-border)]';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--al-bg)] text-[var(--al-text)]">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-[var(--al-card)] border border-[var(--al-border)] rounded-lg p-6 space-y-4"
      >
        <h1 className="text-lg font-semibold text-center">数据管理登录</h1>

        <div className="flex border border-[var(--al-border)] rounded overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('account')}
            className={`flex-1 py-1.5 text-sm ${
              mode === 'account'
                ? 'bg-[var(--al-button-bg)] text-[var(--al-button-text)]'
                : 'text-[var(--al-nav-text)] hover:bg-[var(--al-card-hover)]'
            }`}
          >
            账密登录
          </button>
          <button
            type="button"
            onClick={() => setMode('token')}
            className={`flex-1 py-1.5 text-sm ${
              mode === 'token'
                ? 'bg-[var(--al-button-bg)] text-[var(--al-button-text)]'
                : 'text-[var(--al-nav-text)] hover:bg-[var(--al-card-hover)]'
            }`}
          >
            Token 登录
          </button>
        </div>

        {mode === 'account' ? (
          <>
            <input
              type="text"
              placeholder="用户名 (默认admin)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={inputClass}
              autoComplete="username"
            />
            {/* 密码框 + 眼睛按钮 */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="密码 (默认admin)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--al-nav-text)] hover:text-[var(--al-text)] focus:outline-none"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                tabIndex={-1}
              >
                {showPassword ? (
                  // 眼睛（睁开/可见）
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  // 眼睛（闭/隐藏，带斜线）
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>
          </>
        ) : (
          <input
            type="text"
            placeholder="Token (仅用于开发者临时测试或自动化场景)"
            value={token}
            onChange={e => setTokenInput(e.target.value)}
            className={inputClass}
          />
        )}

        {error && (
          <div className="text-sm text-[var(--al-danger)] bg-[var(--al-danger-bg)] border border-[var(--al-danger-border)] rounded px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 text-sm rounded bg-[var(--al-button-bg)] text-[var(--al-button-text)] disabled:opacity-40"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
