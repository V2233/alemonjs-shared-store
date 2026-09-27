import { EventStore } from 'alemonjs-shared-store/store/classes';
import { PLUGIN_DATA_DIR } from 'alemonjs-shared-store/vars';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// ---------------- 上下文 ----------------

export interface BenchContext {
  store: EventStore;
  dataPath: string;
  cleanup: () => Promise<void>;
}

export function createBenchContext(
  name: string,
  options?: {
    isolation?: Record<string, 'by-bot' | 'by-platform'>;
    enableMessageStorage?: boolean;
    maxCachedGroups?: number;
    maxCachedMessages?: number;
  }
): BenchContext {
  const dataPath = join(PLUGIN_DATA_DIR, `event-store-bench-${name}-${Date.now()}`);
  if (existsSync(dataPath)) rmSync(dataPath, { recursive: true, force: true });
  mkdirSync(dataPath, { recursive: true });

  const store = new EventStore({
    dataPath,
    maxCachedGroups: options?.maxCachedGroups ?? 1000,
    maxCachedMessages: options?.maxCachedMessages ?? 5000,
    flushInterval: 60_000,
    enableMessageStorage: options?.enableMessageStorage ?? true,
    isolation: options?.isolation,
  });

  return {
    store,
    dataPath,
    cleanup: async () => {
      await new Promise(r => setImmediate(r));
      store.close();
      if (existsSync(dataPath)) rmSync(dataPath, { recursive: true, force: true });
    },
  };
}

// ---------------- 造数据 ----------------

export const PLATFORM = 'bench';
export const BOT_ID = 'bot1';

export function makeGroupId(i: number): string {
  return `g_${i.toString(36).padStart(6, '0')}`;
}

export function makeUserId(i: number): string {
  return `u_${i.toString(36).padStart(8, '0')}`;
}

export function makeMember(i: number) {
  const id = makeUserId(i);
  return {
    user_id: id,
    username: `用户${i}`,
    nickname: `群昵称${i}`,
    avatar: `https://example.com/avatar/${id}.png`,
    role: i % 100 === 0 ? 'owner' : 'member',
  };
}

export function makeMessage(i: number, groupId: string, userId: string) {
  return {
    message_id: `m_${i.toString(36).padStart(10, '0')}`,
    group_id: groupId,
    user_id: userId,
    timestamp: 1_700_000_000_000 + i,
    text: `这是第 ${i} 条消息，包含关键词：签到`,
    mentions: i % 10 === 0 ? ['u_mention_target'] : [],
    media: [],
    content: null,
    is_private: false,
    is_at_me: i % 20 === 0,
  };
}

// ---------------- seed ----------------

export async function seedMembers(
  store: EventStore,
  opts: {
    platform?: string;
    botId?: string;
    groups: number;
    membersPerGroup: number;
    batchSize?: number;
  }
): Promise<void> {
  const { platform = PLATFORM, botId = BOT_ID, groups, membersPerGroup, batchSize = 500 } = opts;

  let tasks: Promise<any>[] = [];
  for (let g = 0; g < groups; g++) {
    const gid = makeGroupId(g);
    for (let m = 0; m < membersPerGroup; m++) {
      const member = makeMember(g * membersPerGroup + m);
      tasks.push(store.setGroupMember(platform, botId, gid, member.user_id, member));
      if (tasks.length >= batchSize) {
        await Promise.all(tasks);
        tasks = [];
      }
    }
  }
  if (tasks.length) await Promise.all(tasks);
}

export async function seedMessages(
  store: EventStore,
  opts: {
    platform?: string;
    botId?: string;
    groups: number;
    messagesPerGroup: number;
    usersPerGroup: number;
    batchSize?: number;
  }
): Promise<void> {
  const {
    platform = PLATFORM,
    botId = BOT_ID,
    groups,
    messagesPerGroup,
    usersPerGroup,
    batchSize = 500,
  } = opts;

  let idx = 0;
  let tasks: Promise<any>[] = [];
  for (let g = 0; g < groups; g++) {
    const gid = makeGroupId(g);
    for (let m = 0; m < messagesPerGroup; m++) {
      const uid = makeUserId((g * usersPerGroup + (m % usersPerGroup)) % 100_000);
      const msg = makeMessage(idx++, gid, uid);
      tasks.push(store.appendMessage(platform, botId, msg));
      if (tasks.length >= batchSize) {
        await Promise.all(tasks);
        tasks = [];
      }
    }
  }
  if (tasks.length) await Promise.all(tasks);
}

// ---------------- 计时 ----------------

export interface BenchResult {
  name: string;
  ops: number;
  ms: number;
  opsPerSec: number;
  avgUs: number;
}

export function time(name: string, ops: number, fn: () => void): BenchResult {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return buildResult(name, ops, Number(end - start) / 1e6);
}

export async function timeAsync(
  name: string,
  ops: number,
  fn: () => Promise<void>
): Promise<BenchResult> {
  const start = process.hrtime.bigint();
  await fn();
  const end = process.hrtime.bigint();
  return buildResult(name, ops, Number(end - start) / 1e6);
}

function buildResult(name: string, ops: number, ms: number): BenchResult {
  return {
    name,
    ops,
    ms,
    opsPerSec: (ops / ms) * 1000,
    avgUs: (ms * 1000) / ops,
  };
}

export function formatResult(r: BenchResult): string {
  return (
    `  ${r.name.padEnd(48)} ` +
    `${r.ops.toString().padStart(9)} ops  ` +
    `${r.ms.toFixed(1).padStart(9)} ms  ` +
    `${Math.round(r.opsPerSec).toLocaleString().padStart(14)} ops/s  ` +
    `${r.avgUs.toFixed(2).padStart(8)} us/op`
  );
}

// ---------------- 内存 ----------------

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function memSnapshot(): NodeJS.MemoryUsage {
  if (global.gc) global.gc();
  return process.memoryUsage();
}

export function diffMem(a: NodeJS.MemoryUsage, b: NodeJS.MemoryUsage) {
  return {
    heapUsed: b.heapUsed - a.heapUsed,
    rss: b.rss - a.rss,
    external: b.external - a.external,
  };
}

export function formatMemDiff(d: ReturnType<typeof diffMem>): string {
  return `heap ${formatBytes(d.heapUsed)}, rss ${formatBytes(d.rss)}`;
}
