import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { api, type UserItem } from '../api';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import Table from '../components/Table';

export default function Users() {
  const { platform, botId } = useOutletContext<{ platform: string; botId: string }>();
  const [items, setItems] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const size = 50;
  const navigate = useNavigate();

  useEffect(() => {
    if (!platform || !botId) return;
    setLoading(true);
    api
      .users(platform, botId, keyword, page, size)
      .then(r => {
        setItems(r.items);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, [platform, botId, keyword, page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SearchBar
          value={keyword}
          onChange={v => {
            setKeyword(v);
            setPage(1);
          }}
          placeholder="搜索用户 ID 或昵称..."
        />
        <div className="text-sm text-[var(--al-muted)]">共 {total} 个用户</div>
      </div>
      {loading ? (
        <div className="text-sm text-[var(--al-muted)] py-8 text-center">加载中...</div>
      ) : (
        <Table<UserItem>
          columns={[
            {
              key: 'avatar',
              title: '',
              render: r =>
                r.avatar ? (
                  <img src={r.avatar} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--al-card-hover)]" />
                ),
            },
            { key: 'user_id', title: '用户 ID', className: 'font-mono text-xs' },
            { key: 'username', title: '用户名' },
            { key: 'group_count', title: '所在群数' },
            {
              key: 'updated_at',
              title: '更新时间',
              render: r => new Date(r.updated_at).toLocaleString(),
            },
            {
              key: 'actions',
              title: '操作',
              render: r => (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    navigate(`/users/${r.user_id}/messages?platform=${platform}&botId=${botId}`);
                  }}
                  className="px-2 py-1 text-xs border border-[var(--al-border)] rounded hover:bg-[var(--al-card-hover)]"
                >
                  查看消息
                </button>
              ),
            },
          ]}
          data={items}
          rowKey={r => r.user_id}
          placeholder={{
            text: '暂无数据，数据库使用懒初始化以复用连接实例，请对机器人发送一条消息后再刷新！',
          }}
        />
      )}
      <Pagination page={page} size={size} total={total} onChange={setPage} />
    </div>
  );
}
