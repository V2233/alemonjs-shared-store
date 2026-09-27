import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { api } from '../api';
import AccountMenu from './AccountMenu';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platform, setPlatform] = useState('');
  const [bots, setBots] = useState<string[]>([]);
  const [botId, setBotId] = useState('');

  useEffect(() => {
    api.platforms().then(r => {
      setPlatforms(r.platforms);
      if (r.platforms[0]) setPlatform(r.platforms[0]);
    });
  }, []);

  useEffect(() => {
    if (!platform) return;
    api.bots(platform).then(r => {
      setBots(r.bots);
      setBotId(r.bots[0] ?? '');
    });
  }, [platform]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (platform) url.searchParams.set('platform', platform);
    if (botId) url.searchParams.set('botId', botId);
    window.history.replaceState({}, '', url.toString());
  }, [platform, botId]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'text-[var(--al-link)] font-medium'
      : 'text-[var(--al-nav-text)] hover:text-[var(--al-text)]';

  const selectClass =
    'border border-[var(--al-input-border)] bg-[var(--al-input-bg)] text-[var(--al-input-text)] rounded px-2 py-1 text-sm';

  return (
    <div className="min-h-screen bg-[var(--al-bg)] text-[var(--al-text)]">
      <header className="bg-[var(--al-nav-bg)] border-b border-[var(--al-nav-border)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* 第一行：标题 + 导航 + 主题切换 */}
          <h1 className="text-lg font-semibold">数据管理</h1>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/groups" className={navClass}>
              群
            </NavLink>
            <NavLink to="/users" className={navClass}>
              用户
            </NavLink>
            <NavLink to="/config" className={navClass}>
              配置
            </NavLink>
          </nav>
          <div className="relative ml-auto flex items-center gap-2">
            <ThemeToggle />
            {/* ... platform / botId select ... */}
            <AccountMenu />
          </div>

          {/* 第二行（窄屏）/ 第一行右侧（宽屏）：platform + botId */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className={selectClass + ' flex-1 sm:flex-none sm:min-w-[8rem]'}
            >
              {platforms.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={botId}
              onChange={e => setBotId(e.target.value)}
              className={selectClass + ' flex-1 sm:flex-none sm:min-w-[8rem]'}
            >
              {bots.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet context={{ platform, botId }} />
      </main>
    </div>
  );
}
