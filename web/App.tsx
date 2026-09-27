import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { authApi, clearToken } from './api';
import Layout from './components/Layout';
import Config from './pages/Config';
import GroupDetail from './pages/GroupDetail';
import GroupMessages from './pages/GroupMessages';
import Groups from './pages/Groups';
import Login from './pages/Login';
import UserMessages from './pages/UserMessages';
import Users from './pages/Users';

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'need-login' | 'ok'>('loading');
  const navigate = useNavigate();

  // 初始化：检查登录态
  useEffect(() => {
    authApi
      .status()
      .then(r => {
        if (!r.enabled) {
          setAuthState('ok');
          return;
        }
        if (r.authenticated) {
          setAuthState('ok');
        } else {
          setAuthState('need-login');
        }
      })
      .catch(() => {
        setAuthState('need-login');
      });
  }, []);

  // 监听 401
  useEffect(() => {
    const handler = () => {
      clearToken();
      setAuthState('need-login');
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [navigate]);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--al-muted)]">
        加载中...
      </div>
    );
  }

  if (authState === 'need-login') {
    return (
      <Routes>
        <Route path="/login" element={<Login onSuccess={() => setAuthState('ok')} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/groups" replace />} />
        <Route path="groups" element={<Groups />} />
        <Route path="groups/:groupId" element={<GroupDetail />} />
        <Route path="groups/:groupId/messages" element={<GroupMessages />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:userId/messages" element={<UserMessages />} />
        <Route path="config" element={<Config />} />
      </Route>
      <Route path="*" element={<Navigate to="/groups" replace />} />
    </Routes>
  );
}
