import { API } from '@alemonjs/qq-bot';
import { type Events } from 'alemonjs';

import { makeUserAvatarUrl } from '../utils';
import type { EventStore } from './classes/EventStore';

/** 从 alemonjs 事件提取消息并写入 EventStore */
export async function ingestMessageEvent(store: EventStore, event: Events[keyof Events]) {
  const platform = event.Platform;
  const botId = event.BotId || 'shared';

  switch (event.name) {
    case 'private.message.create':
    case 'message.create': {
      const rawMentions = event.MessageMentions || [];
      const content = event.MessageContent
        ? {
            type: event.MessageContent.type,
            source: event.MessageContent.source,
          }
        : null;

      let isAtMe = event.IsAtMe;

      const mentionIds: string[] = rawMentions
        .filter(mention => {
          if (mention.IsBot) {
            isAtMe = true;
            return false;
          }
          return true;
        })
        .map(m => m.UserId);

      // 私聊：GuildId 可能为空
      const isPrivate = !!event.IsPrivate || !event.GuildId;

      // 发送者写入 users（群聊时同时写 members）
      // setGroupMember 内部会处理 groupId 为空的情况：
      //   - groupId 有值 → 写 users + members
      //   - groupId 为空 → 只写 users
      await store.setGroupMember(platform, botId, event.GuildId, event.UserId, {
        user_id: event.UserId,
        username: event.UserName ?? '',
        nickname: event.value.nickname ?? event.UserName ?? '',
        avatar: event.UserAvatar ?? makeUserAvatarUrl(event.UserId, botId, platform),
        role: event.Role ?? '',
      });

      // 被 @ 的人只在群聊场景写入（私聊没有“被 @ 的人”概念）
      if (!isPrivate) {
        for (const m of rawMentions) {
          if (!m.UserId || m.UserId === botId) continue;
          await store.setGroupMember(platform, botId, event.GuildId, m.UserId, {
            user_id: m.UserId,
            username: m.UserName ?? '',
            nickname: m.UserName ?? '',
            avatar: m.UserAvatar ?? '',
            role: m.Role ?? '',
          });
        }
      }

      // 消息入库
      await store.appendMessage(platform, botId, {
        message_id: event.MessageId,
        group_id: isPrivate ? '' : event.GuildId,
        user_id: event.UserId,
        timestamp: event.Timestamp ?? Date.now(),
        text: event.MessageText ?? '',
        mentions: mentionIds,
        media: event.MessageMedia ?? [],
        content,
        is_private: isPrivate,
        is_at_me: !!isAtMe,
      });

      break;
    }
    case 'message.delete': {
      await store.removeMessage(platform, botId, event.MessageId);
      break;
    }
    case 'member.add':
    case 'member.update': {
      if (!event.GuildId) {
        // logger.warn(`[${APP_NAME}][ingestMessageEvent] ${event.name} 缺少 GuildId，跳过`);
        break;
      }
      await store.setGroupMember(platform, botId, event.GuildId, event.UserId, {
        user_id: event.UserId,
        username: event.UserName ?? '',
        nickname: event.value.nickname ?? event.UserName ?? '',
        avatar: event.UserAvatar ?? makeUserAvatarUrl(event.UserId, botId, platform),
        role: event.Role ?? '',
      });
      break;
    }
    case 'private.friend.remove': {
      // 暂不处理
      // await store.removeGroupMember(platform, botId, event.GuildId, event.UserId);
    }
  }
}

/**
 * 未来可能扩充事件名称字段
 * @experimental
 */
enum EventNames {
  'message.create' = 1,
  'private.message.create' = 1 << 1,
  'interaction.create' = 1 << 2,
  'private.interaction.create' = 1 << 3,
  'message.update' = 1 << 4,
  'message.delete' = 1 << 5,
  'message.reaction.add' = 1 << 6,
  'message.reaction.remove' = 1 << 7,
  'message.pin' = 1 << 8,
  'channel.create' = 1 << 9,
  'channel.delete' = 1 << 10,
  'channel.update' = 1 << 11,
  'guild.join' = 1 << 12,
  'guild.exit' = 1 << 13,
  'guild.update' = 1 << 14,
  'member.add' = 1 << 15,
  'member.remove' = 1 << 16,
  'member.ban' = 1 << 17,
  'member.unban' = 1 << 18,
  'member.update' = 1 << 19,
  'notice.create' = 1 << 20,
  'private.message.update' = 1 << 21,
  'private.message.delete' = 1 << 22,
  'private.friend.add' = 1 << 23,
  'private.friend.remove' = 1 << 24,
  'private.guild.add' = 1 << 25,
  'private.notice.create' = 1 << 26,
  'login.qrcode' = 1 << 27,
  'login.success' = 1 << 28,
  'connection.ready' = 1 << 29,
}

/**
 * 适配各平台主动API，如获取群名称
 * @experimental
 */
function adaptPlatform(platform: string) {
  switch (platform) {
    case 'qq-bot': {
      const api = new API();
      api.groupsInfo('xxxx');
      break;
    }
  }
}
