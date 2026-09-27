import { getScopeAsync } from '../../store';
import { router } from '../router';

/** 某 scope 下的用户列表（分页 + 搜索） */
router.get('/users', async ctx => {
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
      `SELECT u.user_id, u.username, u.avatar, u.updated_at,
              (SELECT COUNT(*) FROM members m WHERE m.user_id = u.user_id) AS group_count
       FROM users u
       WHERE u.user_id LIKE ? OR u.username LIKE ?
       ORDER BY u.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(like, like, Number(size), offset) as any[];

  const total = (
    scope.db
      .prepare('SELECT COUNT(*) AS c FROM users WHERE user_id LIKE ? OR username LIKE ?')
      .get(like, like) as any
  ).c;

  ctx.body = { total, page: Number(page), size: Number(size), items: rows };
});

/** 用户详情 + 所在群 */
router.get('/users/:userId', async ctx => {
  const { platform, botId } = ctx.query as Record<string, string>;
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const user = scope.db
    .prepare('SELECT * FROM users WHERE user_id = ?')
    .get(ctx.params.userId) as any;
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'user not found' };
    return;
  }

  const groups = scope.db
    .prepare(
      `SELECT m.group_id, m.role, m.removed, m.updated_at
       FROM members m WHERE m.user_id = ?`
    )
    .all(ctx.params.userId) as any[];

  ctx.body = { user, groups };
});

export default router;
