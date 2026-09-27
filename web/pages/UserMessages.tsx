import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { api, type MessageItem } from '../api';
import MessageCard from '../components/MessageCard';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';

export default function UserMessages() {
  const { userId } = useParams<{ userId: string }>();
  const [search] = useSearchParams();
  const platform = search.get('platform') ?? '';
  const botId = search.get('botId') ?? '';

  const [items, setItems] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [groupId, setGroupId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const size = 20;

  const reload = () => {
    if (!userId || !platform || !botId) return;
    setLoading(true);
    api
      .userMessages(platform, botId, userId, keyword, groupId, page, size)
      .then(r => {
        setItems(r.items);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, platform, botId, keyword, groupId, page]);

  const handleDelete = async (msg: MessageItem) => {
    await api.deleteUserMessage(platform, botId, userId!, msg.message_id);
    reload();
  };

  const handleDeleteAll = async () => {
    const scope = groupId ? `群 ${groupId}` : '全部（含私聊）';
    if (!confirm(`确定删除该用户 ${scope} 的全部消息？`)) return;
    if (!confirm('此操作不可恢复，再次确认？')) return;
    const r = await api.deleteUserMessages(platform, botId, userId!, groupId);
    alert(`已删除 ${r.changes} 条`);
    setPage(1);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={`/users?platform=${platform}&botId=${botId}`}
          className="text-sm text-[var(--al-link)]"
        >
          ← 返回用户列表
        </Link>
        <h2 className="text-lg font-semibold font-mono">{userId}</h2>
        <span className="text-sm text-[var(--al-muted)]">共 {total} 条消息</span>
        <button
          onClick={handleDeleteAll}
          className="ml-auto px-3 py-1 text-sm rounded border border-[var(--al-danger-border)] text-[var(--al-danger)] hover:bg-[var(--al-danger-bg)]"
        >
          删除该用户{groupId ? '在本群' : '全部'}消息
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={keyword}
          onChange={v => {
            setKeyword(v);
            setPage(1);
          }}
          placeholder="搜索消息文本或 MessageId..."
        />
        <input
          type="text"
          value={groupId}
          onChange={e => {
            setGroupId(e.target.value);
            setPage(1);
          }}
          placeholder="限定群号（留空 = 全部）"
          className="w-64 border border-[var(--al-input-border)] bg-[var(--al-input-bg)] text-[var(--al-input-text)] placeholder:text-[var(--al-input-placeholder)] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--al-primary-border)]"
        />
      </div>

      {loading ? (
        <div className="text-sm text-[var(--al-muted)] py-8 text-center">加载中...</div>
      ) : (
        <div className="space-y-3">
          {items.map(msg => (
            <MessageCard key={msg.message_id} msg={msg} showGroupId onDelete={handleDelete} />
          ))}
          {items.length === 0 && (
            <div className="text-sm text-[var(--al-muted)] py-8 text-center">暂无消息</div>
          )}
        </div>
      )}

      <Pagination page={page} size={size} total={total} onChange={setPage} />
    </div>
  );
}
