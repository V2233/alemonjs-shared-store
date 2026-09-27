import {
  BOT_ID,
  createBenchContext,
  formatResult,
  makeGroupId,
  makeMessage,
  makeUserId,
  PLATFORM,
  timeAsync,
} from './setup.js';

const GROUPS = 50;
const MESSAGES_PER_GROUP = 2000;
const TOTAL = GROUPS * MESSAGES_PER_GROUP;

async function runWithMessageStorage(enabled: boolean) {
  console.log(`\n  [enableMessageStorage: ${enabled}]`);

  const ctx = createBenchContext(`disabled-${enabled}`, {
    enableMessageStorage: enabled,
    maxCachedMessages: Number.MAX_SAFE_INTEGER,
  });
  const { store } = ctx;

  try {
    await store.ready(PLATFORM, BOT_ID);

    const result = await timeAsync(
      `  appendMessage（${enabled ? '启用' : '关闭'}）`,
      TOTAL,
      async () => {
        let idx = 0;
        for (let g = 0; g < GROUPS; g++) {
          const gid = makeGroupId(g);
          for (let m = 0; m < MESSAGES_PER_GROUP; m++) {
            const uid = makeUserId(idx % 10_000);
            const msg = makeMessage(idx++, gid, uid);
            await store.appendMessage(PLATFORM, BOT_ID, msg);
          }
        }
      }
    );
    console.log(formatResult(result));

    store.flush();
    const count = await store.countMessages(PLATFORM, BOT_ID, {});
    console.log(`  countMessages: ${count}（启用时应为 ${TOTAL}，关闭时应为 0）`);
  } finally {
    await ctx.cleanup();
  }
}

export async function benchDisabled() {
  console.log('\n=== enableMessageStorage 对比 benchmark ===');
  await runWithMessageStorage(true);
  await runWithMessageStorage(false);
}
