/**
 * 仅作为无法通过API接口获得头像地址时的默认备选
 * @param userId
 * @param botId
 * @param platform
 * @returns
 */
export function makeUserAvatarUrl(userId: string, botId: string, platform: string) {
  switch (platform) {
    case 'qq-bot':
      return `https://q.qlogo.cn/qqapp/${botId}/${userId}/640`;
    case 'onebot':
    case 'milky':
    case 'qq':
      return `http://q2.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=5`;
    case 'wechat':
    case 'wechat-clawbot':
      return `https://weixin.qq.com/avatar/${userId}`;
    default:
      return '';
  }
}

/**
 * 日志节流工具。
 *
 * 同一个 key 在 interval 毫秒内只执行一次 fn。
 * 首次调用立即执行，后续调用被丢弃（不延迟执行）。
 *
 * @example
 * const log = createThrottle(5000);
 * log('flush-fail:qq-bot:123', () => logger.error('flush 失败'));
 */
export function createThrottle(interval: number) {
  const last = new Map<string, number>();

  return function throttle(key: string, fn: () => void): void {
    const now = Date.now();
    const prev = last.get(key);
    if (prev !== undefined && now - prev < interval) return;
    last.set(key, now);
    fn();
  };
}
