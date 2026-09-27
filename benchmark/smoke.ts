import { BOT_ID, createBenchContext, makeMember, PLATFORM } from './setup.js';

export async function smoke() {
  console.log('\n=== Smoke Test ===');
  const ctx = createBenchContext('smoke');
  const { store } = ctx;

  try {
    await store.ready(PLATFORM, BOT_ID);

    await store.setGroupMember(PLATFORM, BOT_ID, 'g_smoke', 'u_smoke', makeMember(1));
    store.flush();

    const instances = (store as any)._instances as Map<string, any>;
    console.log(`  实例数: ${instances.size}（应为 1）`);

    const group = await store.getGroup(PLATFORM, BOT_ID, 'g_smoke');
    console.log(`  群成员数: ${Object.keys(group?.members ?? {}).length}（应为 1）`);

    const m = await store.getGroupMember(PLATFORM, BOT_ID, 'g_smoke', 'u_smoke');
    console.log(`  getGroupMember 命中: ${m ? '是' : '否'}（应为 是）`);

    await store.appendMessage(PLATFORM, BOT_ID, {
      message_id: 'm_smoke',
      group_id: 'g_smoke',
      user_id: 'u_smoke',
      timestamp: Date.now(),
      text: 'hello smoke',
      mentions: [],
      media: [],
      content: null,
      is_private: false,
      is_at_me: false,
    });
    store.flush();

    const msgs = await store.getMessages(PLATFORM, BOT_ID, { groupId: 'g_smoke' });
    console.log(`  消息数: ${msgs.length}（应为 1）`);

    const count = await store.countMessages(PLATFORM, BOT_ID, { groupId: 'g_smoke' });
    console.log(`  countMessages: ${count}（应为 1）`);

    const ok = await store.removeMessage(PLATFORM, BOT_ID, 'm_smoke');
    console.log(`  removeMessage: ${ok}（应为 true）`);

    const after = await store.getMessages(PLATFORM, BOT_ID, { groupId: 'g_smoke' });
    console.log(`  撤回后消息数: ${after.length}（应为 0）`);

    const { statSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const dbPath = join(ctx.dataPath, PLATFORM, BOT_ID, 'event.db');
    if (existsSync(dbPath)) {
      console.log(`  event.db 大小: ${statSync(dbPath).size} 字节`);
    } else {
      console.log(`  event.db 不存在！`);
    }
  } finally {
    await ctx.cleanup();
  }
}
