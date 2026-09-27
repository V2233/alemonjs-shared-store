import {
  BOT_ID,
  createBenchContext,
  formatResult,
  makeGroupId,
  makeUserId,
  PLATFORM,
  seedMembers,
  timeAsync,
} from './setup.js';

const GROUPS = 100;
const MEMBERS_PER_GROUP = 200;
const TOTAL = GROUPS * MEMBERS_PER_GROUP;

export async function benchList() {
  console.log('\n=== 列表查询 benchmark ===');
  console.log(`  群数: ${GROUPS}, 每群成员: ${MEMBERS_PER_GROUP}, 总成员: ${TOTAL}`);

  const ctx = createBenchContext('list');
  const { store } = ctx;

  try {
    await seedMembers(store, {
      platform: PLATFORM,
      botId: BOT_ID,
      groups: GROUPS,
      membersPerGroup: MEMBERS_PER_GROUP,
    });
    store.flush();

    // 预热缓存
    for (let g = 0; g < GROUPS; g++) {
      await store.getGroup(PLATFORM, BOT_ID, makeGroupId(g));
    }

    // 1) getGroup（返回整个群的成员对象）
    const getGroupMembersResult = await timeAsync(
      'getGroup（100 群，返回 members）',
      GROUPS * 10,
      async () => {
        for (let i = 0; i < 10; i++) {
          for (let g = 0; g < GROUPS; g++) {
            await store.getGroup(PLATFORM, BOT_ID, makeGroupId(g));
          }
        }
      }
    );
    console.log(formatResult(getGroupMembersResult));

    // 2) getUsers（全部，带 limit）
    const getUsersAllResult = await timeAsync('getUsers（全部，limit 100000）', 10, async () => {
      for (let i = 0; i < 10; i++) {
        await store.getUsers(PLATFORM, BOT_ID);
      }
    });
    console.log(formatResult(getUsersAllResult));

    // 3) getUsers（500 个 IN）
    const batch1 = Array.from({ length: 500 }, (_, i) => makeUserId(i));
    const batch2 = Array.from({ length: 500 }, (_, i) => makeUserId(i + 500));
    const getUsersBatchResult = await timeAsync('getUsers（500 个 IN）', 100, async () => {
      for (let i = 0; i < 100; i++) {
        await store.getUsers(PLATFORM, BOT_ID, i % 2 === 0 ? batch1 : batch2);
      }
    });
    console.log(formatResult(getUsersBatchResult));

    // 4) getAllGroupIds
    const getAllGroupIdsResult = await timeAsync('getAllGroupIds', 100, async () => {
      for (let i = 0; i < 100; i++) {
        await store.getAllGroupIds(PLATFORM, BOT_ID);
      }
    });
    console.log(formatResult(getAllGroupIdsResult));

    // 5) getGroupMemberCount
    const memberCountResult = await timeAsync('getGroupMemberCount', GROUPS * 10, async () => {
      for (let i = 0; i < 10; i++) {
        for (let g = 0; g < GROUPS; g++) {
          await store.getGroupMemberCount(PLATFORM, BOT_ID, makeGroupId(g));
        }
      }
    });
    console.log(formatResult(memberCountResult));
  } finally {
    await ctx.cleanup();
  }
}
