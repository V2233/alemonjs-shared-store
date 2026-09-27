import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { api, type MemberItem } from '../api';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import Table from '../components/Table';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const [search] = useSearchParams();
  const platform = search.get('platform') ?? '';
  const botId = search.get('botId') ?? '';

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const size = 50;

  useEffect(() => {
    if (!groupId || !platform || !botId) return;
    setLoading(true);
    api
      .groupDetail(platform, botId, groupId, keyword, page, size)
      .then(r => {
        setMembers(r.members);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, [groupId, platform, botId, keyword, page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link
          to={`/groups?platform=${platform}&botId=${botId}`}
          className="text-sm text-[var(--al-link)]"
        >
          ← 返回群列表
        </Link>
        <h2 className="text-lg font-semibold font-mono">{groupId}</h2>
        <span className="text-sm text-[var(--al-muted)]">共 {total} 名成员</span>
      </div>
      <SearchBar
        value={keyword}
        onChange={v => {
          setKeyword(v);
          setPage(1);
        }}
        placeholder="搜索用户 ID 或昵称..."
      />
      {loading ? (
        <div className="text-sm text-[var(--al-muted)] py-8 text-center">加载中...</div>
      ) : (
        <Table<MemberItem>
          columns={[
            {
              key: 'avatar',
              title: '',
              render: r =>
                r.avatar ? (
                  <img src={r.avatar} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--al-card-hover)]" />
                ),
            },
            { key: 'user_id', title: '用户 ID', className: 'font-mono text-xs' },
            { key: 'username', title: '昵称', render: r => r.username ?? '-' },
            { key: 'role', title: '角色', render: r => r.role ?? '-' },
            {
              key: 'removed',
              title: '状态',
              render: r =>
                r.removed ? (
                  <span className="text-[var(--al-danger)] text-xs">已退群</span>
                ) : (
                  <span className="text-[var(--al-success)] text-xs">在群</span>
                ),
            },
            {
              key: 'updated_at',
              title: '更新时间',
              render: r => new Date(r.updated_at).toLocaleString(),
            },
          ]}
          data={members}
          rowKey={r => r.user_id}
        />
      )}
      <Pagination page={page} size={size} total={total} onChange={setPage} />
    </div>
  );
}
