import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { api, type MessageItem } from '../api';
import MessageCard from '../components/MessageCard';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';

export default function GroupMessages() {
  const { groupId } = useParams<{ groupId: string }>();
  const [search] = useSearchParams();
  const platform = search.get('platform') ?? '';
  const botId = search.get('botId') ?? '';

  const [items, setItems] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const size = 20;

  const reload = () => {
    if (!groupId || !platform || !botId) return;
    setLoading(true);
    api
      .groupMessages(platform, botId, groupId, keyword, page, size)
      .then(r => {
        setItems(r.items);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, platform, botId, keyword, page]);

  const handleDelete = async (msg: MessageItem) => {
    await api.deleteGroupMessage(platform, botId, groupId!, msg.message_id);
    reload();
  };

  const handleDeleteAll = async () => {
    if (!confirm(`确定删除该群的全部消息？\n\n群号：${groupId}`)) return;
    if (!confirm('此操作不可恢复，再次确认？')) return;
    const r = await api.deleteGroupMessages(platform, botId, groupId!);
    alert(`已删除 ${r.changes} 条`);
    setPage(1);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={`/groups?platform=${platform}&botId=${botId}`}
          className="text-sm text-[var(--al-link)]"
        >
          ← 返回群列表
        </Link>
        <h2 className="text-lg font-semibold font-mono">{groupId}</h2>
        <span className="text-sm text-[var(--al-muted)]">共 {total} 条消息</span>
        <button
          onClick={handleDeleteAll}
          className="ml-auto px-3 py-1 text-sm rounded border border-[var(--al-danger-border)] text-[var(--al-danger)] hover:bg-[var(--al-danger-bg)]"
        >
          删除该群全部消息
        </button>
      </div>

      <SearchBar
        value={keyword}
        onChange={v => {
          setKeyword(v);
          setPage(1);
        }}
        placeholder="搜索消息文本或用户 ID..."
      />

      {loading ? (
        <div className="text-sm text-[var(--al-muted)] py-8 text-center">加载中...</div>
      ) : (
        <div className="space-y-3">
          {items.map(msg => (
            <MessageCard key={msg.message_id} msg={msg} onDelete={handleDelete} />
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
