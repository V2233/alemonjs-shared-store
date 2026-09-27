import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authApi, clearToken } from '../api';
import AccountDialog from './AccountDialog';

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 text-xs border border-[var(--al-border)] rounded hover:bg-[var(--al-card-hover)]"
      >
        账户
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-32 bg-[var(--al-card)] border border-[var(--al-border)] rounded shadow z-10">
          <button
            onClick={() => {
              setOpen(false);
              setShowAccount(true);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--al-card-hover)]"
          >
            修改账密
          </button>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-[var(--al-danger)] hover:bg-[var(--al-card-hover)]"
          >
            退出登录
          </button>
        </div>
      )}
      {showAccount && <AccountDialog onClose={() => setShowAccount(false)} />}
    </div>
  );
}
