import { useState } from 'react';

import type { MessageItem } from '../api';

interface Props {
  msg: MessageItem;
  /** 是否显示群号（用户消息页用） */
  showGroupId?: boolean;
  /** 删除回调，不传则不显示删除按钮 */
  onDelete?: (msg: MessageItem) => void;
}

export default function MessageCard({ msg, showGroupId, onDelete }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`确定删除这条消息？\n\n${msg.text.slice(0, 50)}`)) return;
    setDeleting(true);
    try {
      await onDelete(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-[var(--al-card)] border border-[var(--al-border)] rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        {msg.avatar ? (
          <img src={msg.avatar} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--al-card-hover)]" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium">{msg.username || msg.user_id}</span>
          <span className="text-xs text-[var(--al-muted)] font-mono">{msg.user_id}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-[var(--al-muted)]">
          {showGroupId && (
            <span className="font-mono" title={msg.group_id}>
              {msg.is_private ? '私聊' : msg.group_id.slice(0, 8) + '…'}
            </span>
          )}
          {msg.is_private ? (
            <span className="px-1.5 py-0.5 rounded bg-[var(--al-warning-bg)] text-[var(--al-warning)]">
              私聊
            </span>
          ) : null}
          {msg.is_at_me ? (
            <span className="px-1.5 py-0.5 rounded bg-[var(--al-primary-bg)] text-[var(--al-primary)]">
              @Bot
            </span>
          ) : null}
          <span>{new Date(msg.timestamp).toLocaleString()}</span>
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-0.5 rounded border border-[var(--al-danger-border)] text-[var(--al-danger)] hover:bg-[var(--al-danger-bg)] disabled:opacity-40"
            >
              {deleting ? '删除中' : '删除'}
            </button>
          )}
        </div>
      </div>

      {msg.text && <div className="text-sm whitespace-pre-wrap break-words mb-2">{msg.text}</div>}

      <button
        onClick={() => setShowRaw(v => !v)}
        className="text-xs text-[var(--al-link)] hover:underline"
      >
        {showRaw ? '收起详情' : '展开详情'}
      </button>

      {showRaw && (
        <div className="mt-3 space-y-2 text-xs">
          <Field label="MessageId" value={msg.message_id} mono />
          <Field label="GroupId" value={msg.group_id} mono />
          <Field label="UserId" value={msg.user_id} mono />
          <Field label="Timestamp" value={String(msg.timestamp)} />
          <Field label="CreatedAt" value={new Date(msg.created_at).toLocaleString()} />
          <Field label="IsPrivate" value={msg.is_private ? 'true' : 'false'} />
          <Field label="IsAtMe" value={msg.is_at_me ? 'true' : 'false'} />
          <Field label="Mentions" value={msg.mentions} json />
          <Field label="Media" value={msg.media} json />
          <Field label="Content" value={msg.content ?? 'null'} json />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  json,
}: {
  label: string;
  value: string;
  mono?: boolean;
  json?: boolean;
}) {
  let display = value;
  if (json) {
    try {
      display = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      display = value;
    }
  }
  return (
    <div>
      <div className="text-[var(--al-muted)] mb-0.5">{label}</div>
      <pre
        className={`bg-[var(--al-card-hover)] rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all ${
          mono ? 'font-mono' : ''
        }`}
      >
        {display}
      </pre>
    </div>
  );
}
