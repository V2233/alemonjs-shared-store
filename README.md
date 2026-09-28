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

注意：`alemonjs-shared-store`在工作仓库中会自动检测并加载全局最高版本的功能实现模块，使用本库时尽量使用`lib/api`目录下的稳定API，或及时更新`package.json`的依赖，只有仓库中有插件引用本库才会被加载！

## Usage

### 获取事件历史
```ts
// src/response/xxx/res.ts

import { Format, useEvent, useMessage } from 'alemonjs';
import { PLUGIN_NAME } from 'alemonjs-shared-store/vars';

import { useEventStore } from '../../api';

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
  const [message] = useMessage();
  const format = Format.create();

  const store = useEventStore();
  const cmd = event.current.MessageText.replace(prefix, '').trim();

  switch (cmd) {
    // ---------------- 群 ----------------
    case '群是否存在': {
      const msg = `已入库: ${await store.hasGroup()}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '群信息': {
      const group = await store.getGroup();
      if (!group) {
        const msg = '群不存在';
        logger.info(`[${PLUGIN_NAME}]`, msg);
        format.addText(msg);
        message.send({ format });
        break;
      }

      const lines: string[] = [`群号: ${group.group_id}`];
      for (const [uid, m] of Object.entries(group.members)) {
        lines.push(
          `${uid} | ${m.nickname ?? '-'} | ${m.role ?? '-'} | 退群: ${m.removed ? '是' : '否'}`
        );
      }
      const msg = lines.join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '群成员数': {
      const msg = `成员数: ${await store.getGroupMemberCount()}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '群消息数': {
      const notRemoved = await store.getGroupMessageCount();
      const all = await store.getGroupMessageCount({ includeRemoved: true });
      const msg = `不含撤销: ${notRemoved}\n含撤销: ${all}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '所有群号': {
      const ids = await store.getAllGroupIds();
      const msg = `共 ${ids.length} 个群\n${ids.join(', ')}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    // ---------------- 用户 ----------------
    case '当前用户': {
      const user = await store.getUser();
      const msg = user
        ? `userId: ${user.user_id}\n用户名: ${user.username}\n头像: ${user.avatar}`
        : '用户不存在';
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '批量用户': {
      const users = await store.getUsers({ UserIds: ['a', 'b', 'c'] });
      const entries = Object.entries(users);
      const msg =
        entries.length === 0
          ? '未找到用户'
          : entries.map(([uid, u]) => `${uid} | ${u.username}`).join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '全部用户': {
      const users = await store.getUsers({ limit: 1000 });
      const count = Object.keys(users).length;
      const msg = `共 ${count} 个用户（最多显示 1000）`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '查找成员': {
      const lines: string[] = [];

      // 当前群当前发送者
      const m1 = await store.findMember();
      lines.push(`当前: ${m1 ? `${m1.user_id} | ${m1.nickname}` : '未找到'}`);

      // 当前群指定用户
      const m2 = await store.findMember({ UserId: 'xxx' });
      lines.push(`当前群指定用户: ${m2 ? `${m2.user_id} | ${m2.nickname}` : '未找到'}`);

      // 指定群
      const m3 = await store.findMember({ UserId: 'xxx', GuildId: 'yyy' });
      lines.push(`指定群: ${m3 ? `${m3.user_id} | ${m3.nickname}` : '未找到'}`);

      // 全局
      const m4 = await store.findMember({ UserId: 'xxx', GuildId: null });
      lines.push(`全局: ${m4 ? `${m4.user_id} | ${m4.nickname}` : '未找到'}`);

      const msg = lines.join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    // ---------------- 成员 ----------------
    case '当前成员': {
      const m = await store.getGroupMember();
      const msg = m
        ? `userId: ${m.user_id}\n昵称: ${m.nickname ?? '-'}\n角色: ${m.role ?? '-'}\n退群: ${m.removed ? '是' : '否'}`
        : '成员不存在';
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '群员列表': {
      const members = await store.getGroupMembers();
      const arr = store.toArray(members);
      const msg =
        arr.length === 0
          ? '群内暂无成员记录'
          : arr
              .map(m => `${m.user_id} | ${m.nickname ?? '-'} | 退群: ${m.removed ? '是' : '否'}`)
              .join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    // ---------------- 消息 ----------------
    case '最近消息': {
      const msgs = await store.getMessages({ limit: 20 });
      const msg =
        msgs.length === 0
          ? '暂无消息'
          : msgs
              .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.user_id}: ${m.text}`)
              .join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '所有人消息': {
      const msgs = await store.getMessages({ UserId: null, limit: 20 });
      const msg =
        msgs.length === 0
          ? '暂无消息'
          : msgs
              .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.user_id}: ${m.text}`)
              .join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '跨群消息': {
      const msgs = await store.getMessages({ GuildId: null, limit: 20 });
      const msg =
        msgs.length === 0
          ? '暂无消息'
          : msgs.map(m => `[${m.group_id || '私聊'}] ${m.user_id}: ${m.text}`).join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '多群消息': {
      const msgs = await store.getMessages({ GuildId: ['g1', 'g2'], UserId: null });
      const msg =
        msgs.length === 0
          ? '暂无消息'
          : msgs.map(m => `[${m.group_id}] ${m.user_id}: ${m.text}`).join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '关键词': {
      const msgs = await store.getMessages({
        keyword: '签到',
        since: Date.now() - 24 * 3600 * 1000,
        limit: 20,
      });
      const msg =
        msgs.length === 0
          ? '未匹配到消息'
          : msgs
              .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.user_id}: ${m.text}`)
              .join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '我at过谁': {
      // 当前用户在最近 7 天内 @ 过的人
      const msgs = await store.getMessages({
        UserId: event.current.UserId,
        since: Date.now() - 7 * 24 * 3600 * 1000,
        limit: 200,
      });

      // 去重收集被 @ 的 userId
      const mentioned = new Set<string>();
      for (const m of msgs) {
        for (const uid of m.mentions ?? []) {
          if (uid === event.current.UserId) continue;
          mentioned.add(uid);
        }
      }

      const list = [...mentioned];
      const msg =
        list.length === 0
          ? '最近 7 天没有 @ 过任何人'
          : `最近 7 天 @ 过 ${list.length} 人:\n${list.join(', ')}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '谁at我': {
      const msgs = await store.getMessages({
        mention: event.current.UserId,
        limit: 20,
      });
      const msg =
        msgs.length === 0
          ? '最近没有 @ 过你的消息'
          : msgs
              .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.user_id}: ${m.text}`)
              .join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '私聊消息': {
      const msgs = await store.getMessages({ onlyPrivate: true, limit: 20 });
      const msg =
        msgs.length === 0
          ? '暂无私聊消息'
          : msgs
              .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.user_id}: ${m.text}`)
              .join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '按时间': {
      const since = Date.now() - 24 * 3600 * 1000;
      const until = Date.now();
      const msgs = await store.getMessages({ since, until, limit: 20 });
      const msg =
        msgs.length === 0
          ? '该时间段内无消息'
          : msgs
              .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.user_id}: ${m.text}`)
              .join('\n');
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '按ID': {
      const msgRecord = await store.getMessageById({ MessageId: event.current.MessageId });
      const msg = msgRecord
        ? `messageId: ${msgRecord.message_id}\nuserId: ${msgRecord.user_id}\ntext: ${msgRecord.text}`
        : '消息不存在';
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    // ---------------- 统计 ----------------
    case '消息统计': {
      const since = Date.now() - 86400000;
      const count = await store.countMessages({ since });
      const msg = `今日消息数: ${count}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    case '活跃用户': {
      const since = Date.now() - 86400000;
      const count = await store.countActiveUsers({ since });
      const msg = `今日活跃用户数: ${count}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    // ---------------- 元信息 ----------------
    case '上下文': {
      const c = store.context;
      const msg = `platform: ${c.platform}\nbotId: ${c.botId}\nGuildId: ${c.GuildId}\nUserId: ${c.UserId}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
      break;
    }

    default: {
      const msg = `未知指令: ${cmd}`;
      logger.info(`[${PLUGIN_NAME}]`, msg);
      format.addText(msg);
      message.send({ format });
    }
  }
};

```

详细用例可查看`src/response/example/res.ts`

## Performance

采用 `better-sqlite3` + `lru`缓存，兼顾读取性能和内存窗口，`Benchmark`测试结果：[Benchmark.md](./Benchmark.md)

## Contributing (维护指南)

请看 [CONTRIBUTING.md](./CONTRIBUTING.md)