export * from './api';

import { getConfig } from 'alemonjs';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, relative } from 'path';

import pkgJson from '../package.json';
import { APP_NAME, getGlobalNs } from './api/getGlobalNs';

const require = createRequire(import.meta.url);

const WORK_PATH = process.cwd().replace(/\\/g, '/');

await main();

async function main() {
  const namespace = getGlobalNs();
  if (namespace['state'] && namespace['state'] == 'loaded') return;

  if (!namespace['versions']) {
    const botConfig = getConfig();
    const value = botConfig.value || {};
    const apps = value?.apps;

    // 确保加载全局最高版本
    if (Array.isArray(apps)) {
      namespace['versions'] = getAllThisPkgVersions(apps);
    }
  }

  const maxVerion = findMaxVersion(namespace['versions'] as Set<string>);
  if (maxVerion && maxVerion === pkgJson.version) {
    const botConfig = getConfig();
    logger.info(`[${APP_NAME}]开始加载...`);
    logger.info(`[${APP_NAME}]加载版本：${pkgJson.version}`);
    const absolutePath = (await import('alemonjs-shared-store/vars')).PLUGIN_ROOT_DIR;
    logger.info(`[${APP_NAME}]加载路径：${relative(WORK_PATH, absolutePath).replace(/\\/g, '/')}`);
    logger.info(
      `[${APP_NAME}]在线管理地址：http://${'127.0.0.1'}:${botConfig.value?.serverPort || 17187}/apps/${APP_NAME}`
    );
    if (!botConfig.value?.serverPort)
      logger.warn(`[${APP_NAME}]未在 alemon.config.yaml中配置 serverPort ，网页可能无法访问！`);

    await import('./load');
    namespace['state'] = 'loaded';
  }
}

/**
 * 获取所有版本的本包
 */
function getAllThisPkgVersions(apps: string[]) {
  let versions = new Set();

  // 根node_modules
  const monorepoRootThisPkgJsonPath = join(WORK_PATH, 'node_modules', APP_NAME, 'package.json');
  if (existsSync(monorepoRootThisPkgJsonPath)) {
    const pkgJson = JSON.parse(
      readFileSync(monorepoRootThisPkgJsonPath, 'utf8')
    ) as typeof import('../package.json');
    versions.add(pkgJson.version);
  }

  // 每个app的node_modules
  for (const app of apps) {
    try {
      const appMainPath = require.resolve(app);
      if (!appMainPath) continue;

      let appRootDir: string;
      const appPkgJsonPath = require.resolve(`${app}/package`);
      if (appPkgJsonPath) {
        appRootDir = dirname(appPkgJsonPath);
      } else {
        appRootDir = findPackageRoot(appMainPath)!;
      }

      const appThisPkgJsonPath = join(appRootDir, 'node_modules', APP_NAME, 'package.json');
      if (existsSync(appThisPkgJsonPath)) {
        const appThisPkgJson = JSON.parse(
          readFileSync(appThisPkgJsonPath, 'utf8')
        ) as typeof import('../package.json');

        versions.add(appThisPkgJson.version);
      }
    } catch (err) {
      logger.warn(`[${APP_NAME}]检查依赖方[${app}]版本失败：`, err);
    }
  }

  return versions;
}

/**
 * 从 Set 中找出最大的版本号（语义化版本比较）
 * @param versionSet - 包含版本号字符串的 Set，例如 '0.1.0'
 * @returns 最大的版本号，如果 Set 为空则返回 null
 *
 * # Usage
 * ```
 * const versionSet = new Set(['0.1.0', '1.2.3', '0.10.2', '2.0.0', '1.0.0', '0.9.9']);
 *
 * console.log('版本集合:', Array.from(versionSet));
 * console.log('最大版本号:', findMaxVersion(versionSet)); // 输出: 2.0.0
 *
 * // 测试带有 v 前缀的情况
 * const versionSet2 = new Set(['v1.0.0', 'v0.2.0', 'v2.0.1']);
 * console.log('最大版本号 (带 v 前缀):', findMaxVersion(versionSet2)); // 输出: v2.0.1
 *
 * // 测试空 Set
 * console.log('空 Set 返回:', findMaxVersion(new Set())); // 输出: null
 * ```
 */
function findMaxVersion(versionSet: Set<string>) {
  if (!(versionSet instanceof Set) || versionSet.size === 0) {
    return null;
  }

  // 将 Set 转为数组，方便使用 reduce
  const versions = Array.from(versionSet);

  // 版本号比较函数：返回 >0 表示 a 大于 b，<0 表示 a 小于 b，0 表示相等
  const compareVersions = (a, b) => {
    // 去除可能的前导 'v' 或 'V'（如 v1.2.3）
    const cleanA = a.replace(/^[vV]/, '');
    const cleanB = b.replace(/^[vV]/, '');

    // 按点分割并转为数字数组
    const partsA = cleanA.split('.').map(Number);
    const partsB = cleanB.split('.').map(Number);

    // 取较长的长度进行逐位比较，缺失的位视为 0
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA !== numB) {
        return numA - numB;
      }
    }
    return 0;
  };

  // 使用 reduce 找出最大版本
  const maxVersion = versions.reduce((max, current) => {
    return compareVersions(current, max) > 0 ? current : max;
  });

  return maxVersion;
}

/**
 * 从任意文件路径向上查找 package.json
 */
function findPackageRoot(filePath) {
  let dir = dirname(filePath);

  while (dir !== dirname(dir)) {
    // 直到根目录
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      return dir;
    }
    dir = dirname(dir);
  }

  return;
}
