import {
  createBenchContext,
  formatResult,
  makeGroupId,
  makeMember,
  PLATFORM,
  seedMembers,
  timeAsync,
} from './setup.js';

const GROUPS = 50;
const MEMBERS_PER_GROUP = 100;
const BOTS = 5;

export async function benchMultiBot() {
  console.log('\n=== 多 BotId 跨库回退 benchmark ===');
  console.log(`  ${BOTS} 个 botId，每个 ${GROUPS} 群 × ${MEMBERS_PER_GROUP} 成员`);

  const ctx = createBenchContext('multibot');
  const { store } = ctx;

  try {
    for (let b = 0; b < BOTS; b++) {
      await seedMembers(store, {
        platform: PLATFORM,
        botId: `bot${b}`,
        groups: GROUPS,
        membersPerGroup: MEMBERS_PER_GROUP,
      });
    }
    store.flush();

    // 预热所有实例的缓存
    for (let b = 0; b < BOTS; b++) {
      for (let g = 0; g < GROUPS; g++) {
        await store.getGroup(PLATFORM, `bot${b}`, makeGroupId(g));
      }
    }

    const localOps = GROUPS * MEMBERS_PER_GROUP;

    // 1) 本地命中
    const localResult = await timeAsync('getGroupMember（本地 bot0 命中）', localOps, async () => {
      for (let g = 0; g < GROUPS; g++) {
        const gid = makeGroupId(g);
        for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
          const member = makeMember(g * MEMBERS_PER_GROUP + m);
          await store.getGroupMember(PLATFORM, 'bot0', gid, member.user_id);
        }
      }
    });
    console.log(formatResult(localResult));

    // 2) 跨库回退（用户只在 bot4 存在）
    const remoteResult = await timeAsync(
      'getGroupMember（跨库回退到 bot4）',
      localOps,
      async () => {
        for (let g = 0; g < GROUPS; g++) {
          const gid = makeGroupId(g);
          for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
            const member = makeMember(4 * 1_000_000 + g * MEMBERS_PER_GROUP + m);
            await store.getGroupMember(PLATFORM, 'bot0', gid, member.user_id);
          }
        }
      }
    );
    console.log(formatResult(remoteResult));

    // 3) 全 miss
    const missResult = await timeAsync('getGroupMember（全 miss）', 1000, async () => {
      for (let i = 0; i < 1000; i++) {
        await store.getGroupMember(PLATFORM, 'bot0', makeGroupId(0), `not_exist_${i}`);
      }
    });
    console.log(formatResult(missResult));

    // 4) findMember（不带 groupId，跨实例回退）
    const findRemoteResult = await timeAsync(
      'findMember（不带 groupId，跨实例）',
      localOps,
      async () => {
        for (let g = 0; g < GROUPS; g++) {
          for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
            const member = makeMember(4 * 1_000_000 + g * MEMBERS_PER_GROUP + m);
            await store.findMember(PLATFORM, 'bot0', member.user_id);
          }
        }
      }
    );
    console.log(formatResult(findRemoteResult));
  } finally {
    await ctx.cleanup();
  }
}
