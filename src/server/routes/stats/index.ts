import { getScopeAsync } from '../../store';
import { router } from '../router';

router.get('/stats', async ctx => {
  const { platform, botId } = ctx.query as Record<string, string>;
  const scope = await getScopeAsync(platform, botId);
  if (!scope) {
    ctx.status = 404;
    ctx.body = { error: 'scope not found' };
    return;
  }

  const groupCount = (scope.db.prepare('SELECT COUNT(*) AS c FROM groups').get() as any).c;
  const memberCount = (scope.db.prepare('SELECT COUNT(*) AS c FROM members').get() as any).c;
  const activeMemberCount = (
    scope.db.prepare('SELECT COUNT(*) AS c FROM members WHERE removed = 0').get() as any
  ).c;
  const userCount = (scope.db.prepare('SELECT COUNT(*) AS c FROM users').get() as any).c;

  ctx.body = { groupCount, memberCount, activeMemberCount, userCount };
});

router.get('/hello', ctx => {
  ctx.body = { msg: 'hi' };
});

export default router;
