import { useEvent } from 'alemonjs';
import { useEventStore } from 'alemonjs-shared-store';

export default async () => {
  const prefix = '/store ';
  const [event, next] = useEvent({
    selects: ['message.create'],
    prefix,
  });

  if (!event.match.selects || !event.match.prefix) {
    next();
    return;
  }

  const store = useEventStore();
  const cmd = event.current.MessageText.replace(prefix, '').trim();

  switch (cmd) {
    // ---------------- 群 ----------------
    case '群是否存在':
      logger.info(`已入库: ${await store.hasGroup()}`);
      break;

    case '群信息': {
      const group = await store.getGroup();
      if (!group) {
        logger.info('群不存在');
        break;
      }
      logger.info(`群号: ${group.group_id}`);
      for (const [uid, m] of Object.entries(group.members)) {
        logger.info(`  ${uid} | ${m.nickname} | ${m.role} | 退群: ${m.removed ? '是' : '否'}`);
      }
      break;
    }

    case '群成员数':
      logger.info(`成员数: ${await store.getGroupMemberCount()}`);
      break;

    case '群消息数': {
      logger.info(`不含撤销: ${await store.getGroupMessageCount()}`);
      logger.info(`含撤销: ${await store.getGroupMessageCount({ includeRemoved: true })}`);
      break;
    }

    case '所有群号':
      logger.info((await store.getAllGroupIds()).join(', '));
      break;

    // ---------------- 用户 ----------------
    case '当前用户':
      logger.info(await store.getUser());
      break;

    case '批量用户':
      logger.info(await store.getUsers({ UserIds: ['a', 'b', 'c'] }));
      break;

    case '全部用户':
      logger.info(`共 ${Object.keys(await store.getUsers({ limit: 1000 })).length} 个`);
      break;

    case '查找成员': {
      // 当前群当前发送者
      logger.info('当前:', await store.findMember());
      // 当前群指定用户
      logger.info('当前群指定用户:', await store.findMember({ UserId: 'xxx' }));
      // 指定群
      logger.info('指定群:', await store.findMember({ UserId: 'xxx', GuildId: 'yyy' }));
      // 全局
      logger.info('全局:', await store.findMember({ UserId: 'xxx', GuildId: null }));
      break;
    }

    // ---------------- 成员 ----------------
    case '当前成员':
      logger.info(await store.getGroupMember());
      break;

    case '群员列表': {
      const members = await store.getGroupMembers();
      store.toArray(members).forEach(m => {
        logger.info(
          `${m.user_id} | ${m.nickname} | ${m.avatar} | 退群: ${m.removed ? '是' : '否'}`
        );
      });
      break;
    }

    // ---------------- 消息 ----------------
    case '最近消息': {
      const msgs = await store.getMessages({ limit: 20 });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '所有人消息': {
      const msgs = await store.getMessages({ UserId: null, limit: 20 });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '跨群消息': {
      const msgs = await store.getMessages({ GuildId: null, limit: 20 });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '多群消息': {
      const msgs = await store.getMessages({ GuildId: ['g1', 'g2'], UserId: null });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '关键词': {
      const msgs = await store.getMessages({
        keyword: '签到',
        since: Date.now() - 24 * 3600 * 1000,
        limit: 20,
      });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '提及某人': {
      const msgs = await store.getMessages({ mention: 'xxx', limit: 20 });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '所有@我': {
      const msgs = await store.getMessages({ onlyAtMe: true, limit: 20 });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '私聊消息': {
      const msgs = await store.getMessages({ onlyPrivate: true, limit: 20 });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '按时间': {
      const msgs = await store.getMessages({
        since: Date.now() - 24 * 3600 * 1000,
        until: Date.now(),
        limit: 20,
      });
      logger.info(`共 ${msgs.length} 条`);
      break;
    }

    case '按ID': {
      const msg = await store.getMessageById({ MessageId: event.current.MessageId });
      logger.info(msg);
      break;
    }

    // ---------------- 统计 ----------------
    case '消息统计':
      logger.info(`今日: ${await store.countMessages({ since: Date.now() - 86400000 })}`);
      break;

    case '活跃用户':
      logger.info(`今日: ${await store.countActiveUsers({ since: Date.now() - 86400000 })}`);
      break;

    // ---------------- 元信息 ----------------
    case '上下文':
      logger.info(store.context);
      break;

    default:
      logger.info(`未知指令: ${cmd}`);
  }
};
