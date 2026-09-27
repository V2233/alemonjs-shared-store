import {
  BOT_ID,
  createBenchContext,
  formatResult,
  makeGroupId,
  makeMember,
  PLATFORM,
  seedMembers,
  timeAsync,
} from './setup.js';

const GROUPS = 100;
const MEMBERS_PER_GROUP = 200;
const TOTAL = GROUPS * MEMBERS_PER_GROUP;

async function runWithIsolation(mode: 'by-bot' | 'by-platform') {
  console.log(`\n  [${mode}]`);

  const ctx = createBenchContext(`iso-${mode}`, { isolation: { [PLATFORM]: mode } });
  const { store } = ctx;

  try {
    const seedStart = process.hrtime.bigint();
    await seedMembers(store, {
      platform: PLATFORM,
      botId: BOT_ID,
      groups: GROUPS,
      membersPerGroup: MEMBERS_PER_GROUP,
    });
    store.flush();
    const seedMs = Number(process.hrtime.bigint() - seedStart) / 1e6;
    console.log(`  seed 耗时: ${seedMs.toFixed(1)} ms`);

    // 写入
    const writeResult = await timeAsync(`  写入 (${mode})`, TOTAL, async () => {
      for (let g = 0; g < GROUPS; g++) {
        const gid = makeGroupId(g);
        for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
          const member = makeMember(g * MEMBERS_PER_GROUP + m);
          await store.setGroupMember(PLATFORM, BOT_ID, gid, member.user_id, member);
        }
      }
    });
    console.log(formatResult(writeResult));

    // 读取
    for (let g = 0; g < GROUPS; g++) {
      await store.getGroup(PLATFORM, BOT_ID, makeGroupId(g));
    }
    const readResult = await timeAsync(`  读取 (${mode})`, TOTAL, async () => {
      for (let g = 0; g < GROUPS; g++) {
        const gid = makeGroupId(g);
        for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
          const member = makeMember(g * MEMBERS_PER_GROUP + m);
          await store.getGroupMember(PLATFORM, BOT_ID, gid, member.user_id);
        }
      }
    });
    console.log(formatResult(readResult));
  } finally {
    await ctx.cleanup();
  }
}

export async function benchIsolation() {
  console.log('\n=== 隔离模式对比 benchmark ===');
  await runWithIsolation('by-bot');
  await runWithIsolation('by-platform');
}
