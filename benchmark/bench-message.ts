import {
  BOT_ID,
  createBenchContext,
  diffMem,
  formatMemDiff,
  formatResult,
  makeGroupId,
  makeMessage,
  makeUserId,
  memSnapshot,
  PLATFORM,
  time,
  timeAsync,
} from './setup.js';

const GROUPS = 50;
const MESSAGES_PER_GROUP = 2000;
const USERS_PER_GROUP = 50;
const TOTAL = GROUPS * MESSAGES_PER_GROUP;

export async function benchMessage() {
  console.log('\n=== 消息 benchmark ===');
  console.log(`  群数: ${GROUPS}, 每群消息: ${MESSAGES_PER_GROUP}, 总消息: ${TOTAL}`);

  // 用 maxCachedMessages: Infinity，append 不触发自动 flush
  const ctx = createBenchContext('message', {
    maxCachedMessages: Number.MAX_SAFE_INTEGER,
  });
  const { store } = ctx;

  try {
    await store.ready(PLATFORM, BOT_ID);

    // 1) appendMessage（纯内存，await 串行）
    const memBefore = memSnapshot();
    const appendResult = await timeAsync('appendMessage（纯内存，await）', TOTAL, async () => {
      let idx = 0;
      for (let g = 0; g < GROUPS; g++) {
        const gid = makeGroupId(g);
        for (let m = 0; m < MESSAGES_PER_GROUP; m++) {
          const uid = makeUserId((g * USERS_PER_GROUP + (m % USERS_PER_GROUP)) % 100_000);
          const msg = makeMessage(idx++, gid, uid);
          await store.appendMessage(PLATFORM, BOT_ID, msg);
        }
      }
    });
    console.log(formatResult(appendResult));

    const memAfterAppend = memSnapshot();
    console.log(`  append 后内存: ${formatMemDiff(diffMem(memBefore, memAfterAppend))}`);

    // 2) flush（真实落库，10 万条）
    const flushResult = time('flush（落库）', TOTAL, () => store.flush());
    console.log(formatResult(flushResult));

    const memAfterFlush = memSnapshot();
    console.log(`  flush 后内存: ${formatMemDiff(diffMem(memAfterAppend, memAfterFlush))}`);

    // 3) getMessages（按群）
    const byGroupResult = await timeAsync(
      'getMessages（按群，limit 50）',
      GROUPS * 10,
      async () => {
        for (let i = 0; i < 10; i++) {
          for (let g = 0; g < GROUPS; g++) {
            await store.getMessages(PLATFORM, BOT_ID, { groupId: makeGroupId(g) }, { limit: 50 });
          }
        }
      }
    );
    console.log(formatResult(byGroupResult));

    // 4) getMessages（按群 + 按用户）
    const byUserResult = await timeAsync(
      'getMessages（群+用户，limit 50）',
      GROUPS * 10,
      async () => {
        for (let i = 0; i < 10; i++) {
          for (let g = 0; g < GROUPS; g++) {
            const gid = makeGroupId(g);
            const uid = makeUserId(g * USERS_PER_GROUP);
            await store.getMessages(PLATFORM, BOT_ID, { groupId: gid, userId: uid }, { limit: 50 });
          }
        }
      }
    );
    console.log(formatResult(byUserResult));

    // 5) getMessages（keyword LIKE，全表扫描）
    const keywordResult = await timeAsync('getMessages（keyword LIKE，含 since）', 10, async () => {
      for (let i = 0; i < 10; i++) {
        await store.getMessages(
          PLATFORM,
          BOT_ID,
          { keyword: '签到', since: 1_700_000_000_000 },
          { limit: 50 }
        );
      }
    });
    console.log(formatResult(keywordResult));

    // 6) getMessages（mention LIKE）
    const mentionResult = await timeAsync('getMessages（mention LIKE，含 since）', 10, async () => {
      for (let i = 0; i < 10; i++) {
        await store.getMessages(
          PLATFORM,
          BOT_ID,
          { mention: 'u_mention_target', since: 1_700_000_000_000 },
          { limit: 50 }
        );
      }
    });
    console.log(formatResult(mentionResult));

    // 7) getMessages（onlyAtMe）
    const atMeResult = await timeAsync('getMessages（onlyAtMe）', GROUPS * 10, async () => {
      for (let i = 0; i < 10; i++) {
        for (let g = 0; g < GROUPS; g++) {
          await store.getMessages(
            PLATFORM,
            BOT_ID,
            { groupId: makeGroupId(g), onlyAtMe: true },
            { limit: 50 }
          );
        }
      }
    });
    console.log(formatResult(atMeResult));

    // 8) getMessages（since 时间范围）
    const sinceResult = await timeAsync('getMessages（since 时间范围）', GROUPS * 10, async () => {
      for (let i = 0; i < 10; i++) {
        for (let g = 0; g < GROUPS; g++) {
          await store.getMessages(
            PLATFORM,
            BOT_ID,
            { groupId: makeGroupId(g), since: 1_700_050_000_000 },
            { limit: 50 }
          );
        }
      }
    });
    console.log(formatResult(sinceResult));

    // 9) countMessages
    const countResult = await timeAsync('countMessages（按群）', GROUPS * 10, async () => {
      for (let i = 0; i < 10; i++) {
        for (let g = 0; g < GROUPS; g++) {
          await store.countMessages(PLATFORM, BOT_ID, { groupId: makeGroupId(g) });
        }
      }
    });
    console.log(formatResult(countResult));

    // 10) countActiveUsers
    const activeResult = await timeAsync('countActiveUsers', GROUPS, async () => {
      for (let g = 0; g < GROUPS; g++) {
        await store.countActiveUsers(PLATFORM, BOT_ID, makeGroupId(g), 1_700_000_000_000);
      }
    });
    console.log(formatResult(activeResult));

    // 11) getMessageById
    const getByIdResult = await timeAsync('getMessageById', 1000, async () => {
      for (let i = 0; i < 1000; i++) {
        const msg = makeMessage(i, makeGroupId(0), makeUserId(0));
        await store.getMessageById(PLATFORM, BOT_ID, msg.message_id);
      }
    });
    console.log(formatResult(getByIdResult));

    // 12) removeMessage（单条）
    const removeResult = await timeAsync('removeMessage（单条）', 1000, async () => {
      for (let i = 0; i < 1000; i++) {
        const msg = makeMessage(i, makeGroupId(0), makeUserId(0));
        await store.removeMessage(PLATFORM, BOT_ID, msg.message_id);
      }
    });
    console.log(formatResult(removeResult));

    // 13) removeMessages（批量 500）
    const batchIds = Array.from(
      { length: 500 },
      (_, i) => makeMessage(i, makeGroupId(0), makeUserId(0)).message_id
    );
    const removeBatchResult = await timeAsync('removeMessages（500 个批量）', 20, async () => {
      for (let i = 0; i < 20; i++) {
        await store.removeMessages(PLATFORM, BOT_ID, batchIds);
      }
    });
    console.log(formatResult(removeBatchResult));

    const memEnd = memSnapshot();
    console.log(`  最终内存: ${formatMemDiff(diffMem(memAfterFlush, memEnd))}`);
  } finally {
    await ctx.cleanup();
  }
}
