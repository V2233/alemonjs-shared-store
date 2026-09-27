import { getScopeAsync, listBots, listPlatforms } from '../../store';
import { router } from '../router';

/** 平台列表 */
router.get('/platforms', async ctx => {
  ctx.body = { platforms: await listPlatforms() };
});

/** 某平台下的 BotId 列表 */
router.get('/platforms/:platform/bots', async ctx => {
  ctx.body = { bots: await listBots(ctx.params.platform) };
});

/** 某 scope 下的群列表（分页 + 搜索） */
router.get('/groups', async ctx => {
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

  const offset = (Number(page) - 1) * Number(size);
  const like = `%${keyword}%`;

  const rows = scope.db
    .prepare(
      `SELECT g.group_id, g.updated_at,
              (SELECT COUNT(*) FROM members m WHERE m.group_id = g.group_id) AS member_count,
              (SELECT COUNT(*) FROM members m WHERE m.group_id = g.group_id AND m.removed = 0) AS active_count,
              (SELECT COUNT(*) FROM messages msg WHERE msg.group_id = g.group_id) AS message_count
       FROM groups g
       WHERE g.group_id LIKE ?
       ORDER BY g.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(like, Number(size), offset) as any[];

  const total = (
    scope.db.prepare('SELECT COUNT(*) AS c FROM groups WHERE group_id LIKE ?').get(like) as any
  ).c;

  ctx.body = { total, page: Number(page), size: Number(size), items: rows };
});

/** 群详情 + 成员列表 */
router.get('/groups/:groupId', async ctx => {
  const {
    platform,
    botId,
    keyword = '',
    page = '1',
    size = '100',
  } = ctx.query as Record<string, string>;
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const group = scope.db
    .prepare('SELECT group_id, updated_at FROM groups WHERE group_id = ?')
    .get(ctx.params.groupId) as any;
  if (!group) {
    ctx.status = 404;
    ctx.body = { error: 'group not found' };
    return;
  }

  const offset = (Number(page) - 1) * Number(size);
  const like = `%${keyword}%`;

  const members = scope.db
    .prepare(
      `SELECT m.user_id, m.nickname, m.role, m.removed, m.updated_at,
              u.username, u.avatar
       FROM members m
       LEFT JOIN users u ON u.user_id = m.user_id
       WHERE m.group_id = ?
         AND (m.user_id LIKE ? OR u.username LIKE ?)
       ORDER BY m.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(ctx.params.groupId, like, like, Number(size), offset) as any[];

  const total = (
    scope.db
      .prepare(
        `SELECT COUNT(*) AS c FROM members m
         LEFT JOIN users u ON u.user_id = m.user_id
         WHERE m.group_id = ? AND (m.user_id LIKE ? OR u.username LIKE ?)`
      )
      .get(ctx.params.groupId, like, like) as any
  ).c;

  ctx.body = { group, total, page: Number(page), size: Number(size), members };
});

export default router;
