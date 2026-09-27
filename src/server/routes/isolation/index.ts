import { listIsolation, setIsolation, type IsolationMode } from '../../isolation';
import { router } from '../router';

router.get('/isolation', ctx => {
  ctx.body = { items: listIsolation() };
});

router.put('/isolation/:platform', ctx => {
  const body = (ctx.request as any).body ?? {};
  const mode = body.mode;
  if (mode !== null && mode !== 'by-bot' && mode !== 'by-platform') {
    ctx.status = 400;
    ctx.body = { error: 'mode must be by-bot | by-platform | null' };
    return;
  }
  setIsolation(ctx.params.platform, mode as IsolationMode | null);
  ctx.body = { ok: true };
});

export default router;
