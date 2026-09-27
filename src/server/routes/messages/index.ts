import { getScopeAsync } from '../../store';
import { router } from '../router';

// ---------------- 群消息 ----------------

/** 群消息列表（分页 + 搜索） */
router.get('/groups/:groupId/messages', async ctx => {
  const {
    platform,
    botId,
    keyword = '',
    page = '1',
    size = '50',
  } = ctx.query as Record<string, string>;
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const group = scope.db
    .prepare('SELECT group_id FROM groups WHERE group_id = ?')
    .get(ctx.params.groupId) as any;
  if (!group) {
    ctx.status = 404;
    ctx.body = { error: 'group not found' };
    return;
  }

  const offset = (Number(page) - 1) * Number(size);
  const like = `%${keyword}%`;

  const rows = scope.db
    .prepare(
      `SELECT message_id, group_id, user_id, timestamp, text, mentions, media, content,
              is_private, is_at_me, created_at
       FROM messages
       WHERE group_id = ?
         AND (text LIKE ? OR user_id LIKE ?)
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`
    )
    .all(ctx.params.groupId, like, like, Number(size), offset) as any[];

  const total = (
    scope.db
      .prepare(
        `SELECT COUNT(*) AS c FROM messages
         WHERE group_id = ? AND (text LIKE ? OR user_id LIKE ?)`
      )
      .get(ctx.params.groupId, like, like) as any
  ).c;

  // 补发送者昵称
  const userIds = [...new Set(rows.map(r => r.user_id))];
  const userMap: Record<string, { username: string; avatar: string }> = {};
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',');
    const users = scope.db
      .prepare(`SELECT user_id, username, avatar FROM users WHERE user_id IN (${placeholders})`)
      .all(...userIds) as any[];
    for (const u of users) userMap[u.user_id] = { username: u.username, avatar: u.avatar };
  }

  const items = rows.map(r => ({
    ...r,
    username: userMap[r.user_id]?.username ?? '',
    avatar: userMap[r.user_id]?.avatar ?? '',
  }));

  ctx.body = { total, page: Number(page), size: Number(size), items };
});

/** 删除单条消息 */
router.delete('/groups/:groupId/messages/:messageId', async ctx => {
  const { platform, botId } = ctx.query as Record<string, string>;
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const result = scope.db
    .prepare('DELETE FROM messages WHERE message_id = ? AND group_id = ?')
    .run(ctx.params.messageId, ctx.params.groupId);

  if (result.changes === 0) {
    ctx.status = 404;
    ctx.body = { error: 'message not found' };
    return;
  }

  ctx.body = { ok: true, changes: result.changes };
});

/** 删除某群全部消息 */
router.delete('/groups/:groupId/messages', async ctx => {
  const { platform, botId, confirm } = ctx.query as Record<string, string>;
  if (confirm !== 'yes') {
    ctx.status = 400;
    ctx.body = { error: 'missing confirm=yes' };
    return;
  }
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const result = scope.db
    .prepare('DELETE FROM messages WHERE group_id = ?')
    .run(ctx.params.groupId);

  ctx.body = { ok: true, changes: result.changes };
});

// ---------------- 用户消息 ----------------

/** 用户消息列表（跨群 + 私聊，分页 + 搜索） */
router.get('/users/:userId/messages', async ctx => {
  const {
    platform,
    botId,
    keyword = '',
    groupId = '',
    page = '1',
    size = '50',
  } = ctx.query as Record<string, string>;
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const offset = (Number(page) - 1) * Number(size);
  const like = `%${keyword}%`;
  const groupCond = groupId ? 'AND group_id = ?' : '';
  const groupArgs = groupId ? [groupId] : [];

  const rows = scope.db
    .prepare(
      `SELECT message_id, group_id, user_id, timestamp, text, mentions, media, content,
              is_private, is_at_me, created_at
       FROM messages
       WHERE user_id = ?
         ${groupCond}
         AND (text LIKE ? OR message_id LIKE ?)
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`
    )
    .all(ctx.params.userId, ...groupArgs, like, like, Number(size), offset) as any[];

  const total = (
    scope.db
      .prepare(
        `SELECT COUNT(*) AS c FROM messages
         WHERE user_id = ?
           ${groupCond}
           AND (text LIKE ? OR message_id LIKE ?)`
      )
      .get(ctx.params.userId, ...groupArgs, like, like) as any
  ).c;

  // 补用户信息（当前用户自己的 username/avatar）
  const user = scope.db
    .prepare('SELECT username, avatar FROM users WHERE user_id = ?')
    .get(ctx.params.userId) as any;

  // 如果用户消息里出现了其他人的 user_id（比如 @ 的人），也可以批量补，但列表页只显示发送者
  const items = rows.map(r => ({
    ...r,
    username: user?.username ?? '',
    avatar: user?.avatar ?? '',
  }));

  ctx.body = { total, page: Number(page), size: Number(size), items };
});

/** 删除单条用户消息（按 message_id） */
router.delete('/users/:userId/messages/:messageId', async ctx => {
  const { platform, botId } = ctx.query as Record<string, string>;
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const result = scope.db
    .prepare('DELETE FROM messages WHERE message_id = ? AND user_id = ?')
    .run(ctx.params.messageId, ctx.params.userId);

  if (result.changes === 0) {
    ctx.status = 404;
    ctx.body = { error: 'message not found' };
    return;
  }

  ctx.body = { ok: true, changes: result.changes };
});

/** 删除某用户全部消息 */
router.delete('/users/:userId/messages', async ctx => {
  const { platform, botId, groupId = '', confirm } = ctx.query as Record<string, string>;
  if (confirm !== 'yes') {
    ctx.status = 400;
    ctx.body = { error: 'missing confirm=yes' };
    return;
  }
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const groupCond = groupId ? 'AND group_id = ?' : '';
  const groupArgs = groupId ? [groupId] : [];

  const result = scope.db
    .prepare(`DELETE FROM messages WHERE user_id = ? ${groupCond}`)
    .run(ctx.params.userId, ...groupArgs);

  ctx.body = { ok: true, changes: result.changes };
});

export default router;
