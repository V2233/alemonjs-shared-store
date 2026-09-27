import { benchDisabled } from './bench-disabled.js';
import { benchGroup } from './bench-group.js';
import { benchIsolation } from './bench-isolation.js';
import { benchList } from './bench-list.js';
import { benchMessage } from './bench-message.js';
import { benchMultiBot } from './bench-multibot.js';
import { smoke } from './smoke.js';

async function main() {
  const which = process.argv[2] ?? 'all';

  console.log('================================================');
  console.log(' EventStore Benchmark');
  console.log(' Node:', process.version);
  console.log(' Platform:', process.platform, process.arch);
  console.log('================================================');

  if (which === 'all' || which === 'smoke') {
    await smoke();
    if (which === 'smoke') return;
  }
  if (which === 'all' || which === 'group') await benchGroup();
  if (which === 'all' || which === 'message') await benchMessage();
  if (which === 'all' || which === 'list') await benchList();
  if (which === 'all' || which === 'multibot') await benchMultiBot();
  if (which === 'all' || which === 'isolation') await benchIsolation();
  if (which === 'all' || which === 'disabled') await benchDisabled();

  console.log('\n完成。');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
