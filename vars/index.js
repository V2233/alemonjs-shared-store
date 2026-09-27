//@ts-check

import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const PLUGIN_NAME = 'alemonjs-shared-store';

const _dirname = dirname(fileURLToPath(import.meta.url));

// 根路径
const WORK_PATH = process.cwd().replace(/\\/g, '/');

/** 插件数据目录 */
const PLUGIN_DATA_DIR = join(
  WORK_PATH,
  // '..',
  // 'alemonjs-cheese', // 临时测试
  '.data',
  PLUGIN_NAME
);

// 检查数据目录
if (!existsSync(PLUGIN_DATA_DIR)) mkdirSync(PLUGIN_DATA_DIR, { recursive: true });

/** 插件根目录 */
const PLUGIN_ROOT_DIR = join(_dirname, '..');

export { PLUGIN_DATA_DIR, PLUGIN_NAME, PLUGIN_ROOT_DIR };
