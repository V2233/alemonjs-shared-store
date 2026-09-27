// TODO: 仅在未来可能迁移到`packages`时使用，当前版本不参与实际运行
import { getConfig } from 'alemonjs';
import pkgJson from 'alemonjs-shared-store/package';

const botConfig = getConfig();
const value = botConfig.value || {};
const apps = value?.apps || [];

if (Array.isArray(apps)) {
  if (!apps?.includes(pkgJson.name)) {
    // 尽量在前面加载
    apps.unshift(pkgJson.name);
    value.apps = apps;
    botConfig.saveValue(value);
    botConfig.reload();
  }
}
