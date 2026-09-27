import { config, type IsolationMode } from '../config';

export type { IsolationMode };

/**
 * 列出所有平台的分库策略。
 * - mode：默认策略
 * - override：用户覆盖（与默认不同才有值）
 */
export function listIsolation() {
  const defaults = config.defaultValue.eventStore.isolation;
  const current = config.eventStore.isolation;
  const platforms = new Set<string>([...Object.keys(defaults), ...Object.keys(current)]);

  return [...platforms].map(platform => {
    const def = defaults[platform] ?? 'by-bot';
    const cur = current[platform] ?? def;
    return {
      platform,
      mode: def,
      override: cur !== def ? cur : null,
    };
  });
}

export function setIsolation(platform: string, mode: IsolationMode | null) {
  config.setIsolation(platform, mode);
}
