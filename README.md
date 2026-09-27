# alemonjs-shared-store

alemonjs 共享状态存储库

适用于插件进行用户信息查询、上下文历史消息获取等

## Features

- 基于事件持久化存储消息历史、群员、用户列表等
- 跨平台协议，减小按不同平台调用主动API的麻烦
- 所有插件共享同一份数据，降低内存实例占用
- 高性能读写缓存优化、冗余去重优化

## Why

为什么不直接调用各平台主动API? 以获取群列表为例，拥有以下缺陷：

- 平台差异大，调用麻烦且需自行处理返回字段
- 主动请求有接口速率限制，需要自己管理缓存
- 平台可能有隐私限制，如`qq-bot`需内邀申请

> 获取消息历史也同理

## Install

在`你的插件`目录下安装：
```bash
yarn add alemonjs-shared-store
```

启动机器人后可在线管理数据库（终端打印输出为准）：[http://127.0.0.1:17187/apps/alemonjs-shared-store](http://127.0.0.1:17187/apps/alemonjs-shared-store)

注意：`alemonjs-shared-store`在工作仓库中会自动检测并加载全局最高版本的功能实现模块，使用本库时尽量使用`lib/api`目录下的稳定API，或及时更新`package.json`的依赖

## Usage

### 获取事件历史
```ts
import { useEvent } from 'alemonjs';
import { useEventStore } from 'alemonjs-shared-store';

export default async () => {
  const [event, next] = useEvent({
    selects: ['message.create'],
    prefix: '/store',
  });

  if (!event.match.selects || !event.match.prefix) {
    next();
    return;
  }

  const store = useEventStore();
  const cmd = event.current.MessageText.replace('/store', '').trim();

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
        logger.info(`${m.user_id} | ${m.nickname} | ${m.avatar} | 退群: ${m.removed ? '是' : '否'}`);
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

```

## Performance

采用 `better-sqlite3` + `lru`缓存，兼顾读取性能和内存窗口，`Benchmark`测试结果：[Benchmark.md](./Benchmark.md)

## Contributing (维护指南)

请看 [CONTRIBUTING.md](./CONTRIBUTING.md)