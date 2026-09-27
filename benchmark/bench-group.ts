import {
  BOT_ID,
  createBenchContext,
  diffMem,
  formatMemDiff,
  formatResult,
  makeGroupId,
  makeMember,
  makeUserId,
  memSnapshot,
  PLATFORM,
  time,
  timeAsync,
} from './setup.js';

const GROUPS = 100;
const MEMBERS_PER_GROUP = 200;
const TOTAL = GROUPS * MEMBERS_PER_GROUP;

export async function benchGroup() {
  console.log('\n=== 群 / 成员 / 用户 benchmark ===');
  console.log(`  群数: ${GROUPS}, 每群成员: ${MEMBERS_PER_GROUP}, 总成员: ${TOTAL}`);

  const ctx = createBenchContext('group');
  const { store } = ctx;

  try {
    await store.ready(PLATFORM, BOT_ID);

    // 1) 写入（内存，await 串行）
    const memBefore = memSnapshot();
    const writeResult = await timeAsync('setGroupMember（内存，await）', TOTAL, async () => {
      for (let g = 0; g < GROUPS; g++) {
        const gid = makeGroupId(g);
        for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
          const member = makeMember(g * MEMBERS_PER_GROUP + m);
          await store.setGroupMember(PLATFORM, BOT_ID, gid, member.user_id, member);
        }
      }
    });
    console.log(formatResult(writeResult));

    const memAfterWrite = memSnapshot();
    console.log(`  写入后内存: ${formatMemDiff(diffMem(memBefore, memAfterWrite))}`);

    // 2) flush（真实落库）
    const flushResult = time('flush（落库）', TOTAL, () => store.flush());
    console.log(formatResult(flushResult));

    // 3) 清缓存，强制 DB 回源
    const instances = (store as any)._instances as Map<string, any>;
    for (const inst of instances.values()) inst.cache.clear();

    // 4) getGroup（DB 回源）
    const coldReadResult = await timeAsync('getGroup（DB 回源）', GROUPS, async () => {
      for (let g = 0; g < GROUPS; g++) {
        const inst = [...instances.values()][0];
        const gid = makeGroupId(g);
        inst.cache.delete(gid);
        await store.getGroup(PLATFORM, BOT_ID, gid);
      }
    });
    console.log(formatResult(coldReadResult));

    // 5) getGroup（LRU 命中）
    const hotReadResult = await timeAsync('getGroup（LRU 命中）', GROUPS * 100, async () => {
      for (let i = 0; i < 100; i++) {
        for (let g = 0; g < GROUPS; g++) {
          await store.getGroup(PLATFORM, BOT_ID, makeGroupId(g));
        }
      }
    });
    console.log(formatResult(hotReadResult));

    // 6) getGroupMember（LRU 命中）
    const getMemberResult = await timeAsync('getGroupMember（LRU 命中）', TOTAL, async () => {
      for (let g = 0; g < GROUPS; g++) {
        const gid = makeGroupId(g);
        for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
          const member = makeMember(g * MEMBERS_PER_GROUP + m);
          await store.getGroupMember(PLATFORM, BOT_ID, gid, member.user_id);
        }
      }
    });
    console.log(formatResult(getMemberResult));

    // 7) findMember（带 groupId，命中）
    const findWithGroupResult = await timeAsync(
      'findMember（带 groupId，命中）',
      TOTAL,
      async () => {
        for (let g = 0; g < GROUPS; g++) {
          const gid = makeGroupId(g);
          for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
            const member = makeMember(g * MEMBERS_PER_GROUP + m);
            await store.findMember(PLATFORM, BOT_ID, member.user_id, gid);
          }
        }
      }
    );
    console.log(formatResult(findWithGroupResult));

    // 8) findMember（不带 groupId，走 userIndex）
    const findNoGroupResult = await timeAsync(
      'findMember（不带 groupId，userIndex）',
      TOTAL,
      async () => {
        for (let g = 0; g < GROUPS; g++) {
          for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
            const member = makeMember(g * MEMBERS_PER_GROUP + m);
            await store.findMember(PLATFORM, BOT_ID, member.user_id);
          }
        }
      }
    );
    console.log(formatResult(findNoGroupResult));

    // 9) getUser（主键）
    const getUserResult = await timeAsync('getUser（主键）', TOTAL, async () => {
      for (let g = 0; g < GROUPS; g++) {
        for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
          const member = makeMember(g * MEMBERS_PER_GROUP + m);
          await store.getUser(PLATFORM, BOT_ID, member.user_id);
        }
      }
    });
    console.log(formatResult(getUserResult));

    // 10) getUsers（500 个 IN）
    const batch = Array.from({ length: 500 }, (_, i) => makeUserId(i));
    const getUsersResult = await timeAsync('getUsers（500 个 IN）', 200, async () => {
      for (let i = 0; i < 200; i++) {
        await store.getUsers(PLATFORM, BOT_ID, batch);
      }
    });
    console.log(formatResult(getUsersResult));

    const memEnd = memSnapshot();
    console.log(`  最终内存: ${formatMemDiff(diffMem(memAfterWrite, memEnd))}`);
  } finally {
    await ctx.cleanup();
  }
}
