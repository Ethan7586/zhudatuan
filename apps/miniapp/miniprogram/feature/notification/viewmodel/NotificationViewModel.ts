import { bindEndpointsManage, bindNotificationsAck, bindNotificationsRead, bindPreferencesManage, bindPreferencesRead } from '@shop/sdk/notification';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { chineseDomainLabel } from '@shop/presentation/chinese';
import { displayItem, displayPage } from '../../../shared/Display';

export const notificationViewModel = defineMiniappFeature({
  defaultRoute: 'miniappnotifications', routes: ['miniappnotifications'], title: '消息中心', description: '订单、福利和服务消息集中查看。',
  connect: (executor) => connectMiniappClient({ notification: {
    endpointsManage: bindEndpointsManage(executor), notificationsAck: bindNotificationsAck(executor), notificationsRead: bindNotificationsRead(executor),
    preferencesManage: bindPreferencesManage(executor), preferencesRead: bindPreferencesRead(executor),
  } }),
  read: async (client, context) => {
    const [notifications, preferences] = await Promise.all([
      client.notification.notificationsRead({ query: { limit: 30 } }, context),
      client.notification.preferencesRead({ query: { limit: 100 } }, context),
    ]);
    return Object.freeze({ notifications, preferences });
  },
  project: (value) => {
    const source = notification(value);
    return displayPage(
      source.notifications.items.map((item) => displayItem(item.id, item.subject ?? '业务通知', item.body, item.read_at === null ? 'pending' : 'completed', item.created_at)),
      source.preferences.items.map((item) => displayItem(item.cursor_id, `${chineseDomainLabel(item.channel)}通知偏好`, item.enabled ? '已接收这类业务消息' : '已关闭这类业务消息', item.enabled ? 'enabled' : 'disabled', item.authorized_at))
    );
  },
  actions: (value) => {
    const source = notification(value);
    const unread = source.notifications.items.flatMap((item, index) => item.read_at === null ? [Object.freeze({ id: `ack:${index}`, label: `标记“${item.subject ?? '这条消息'}”为已读`, description: '仅更新这条消息的阅读状态。', tone: 'secondary' as const, fields: [] })] : []);
    const preferences = source.preferences.items.map((item, index) => Object.freeze({
      id: `preference:${index}`,
      label: `${item.enabled ? '关闭' : '开启'}这类${chineseDomainLabel(item.channel)}消息`,
      description: '通知偏好按事件和渠道独立保存，不影响必须送达的交易结果。',
      tone: 'secondary' as const,
      expectedVersion: item.version,
      fields: [],
    }));
    const wechatEnabled = source.preferences.items.some((item) => item.channel === 'wechat' && item.enabled);
    const endpointVersion = source.preferences.items.find((item) => item.channel === 'wechat')?.version;
    return [...unread, ...preferences, ...(endpointVersion === undefined ? [] : [Object.freeze({ id: 'endpoint', label: wechatEnabled ? '关闭微信消息授权' : '开启微信消息授权', description: '授权状态由微信与服务端共同确认。', tone: wechatEnabled ? 'danger' as const : 'primary' as const, expectedVersion: endpointVersion, ...(wechatEnabled ? { confirmation: '确认关闭微信消息授权？重要交易结果仍可在消息中心查看。' } : {}), fields: [] })])];
  },
  execute: async (client, context, _route, value, action) => {
    const source = notification(value);
    const acknowledgment = /^ack:(\d+)$/.exec(action.id);
    if (acknowledgment !== null) {
      const item = source.notifications.items[Number(acknowledgment[1])];
      if (item === undefined || item.read_at !== null) throw new Error('MINIAPP_NOTIFICATION_INVALID');
      await client.notification.notificationsAck({ path: { notificationid: item.id }, body: {} }, context);
      return { message: '消息已标记为已读。' };
    }
    const preference = /^preference:(\d+)$/.exec(action.id);
    if (preference !== null) {
      const item = source.preferences.items[Number(preference[1])];
      if (item === undefined) throw new Error('MINIAPP_NOTIFICATION_PREFERENCE_INVALID');
      await client.notification.preferencesManage({ path: { channel: item.channel, eventtype: item.event_type }, body: { enabled: !item.enabled, quietHours: null } }, context);
      return { message: '通知偏好已更新。' };
    }
    if (action.id !== 'endpoint') throw new Error('MINIAPP_NOTIFICATION_ACTION_INVALID');
    const enabled = !source.preferences.items.some((item) => item.channel === 'wechat' && item.enabled);
    await client.notification.endpointsManage({ path: { channel: 'wechat' }, body: { enabled, ...(enabled ? { authorization: 'accepted' as const } : {}) } }, context);
    return { message: enabled ? '微信消息授权已开启。' : '微信消息授权已关闭。' };
  },
});

interface NotificationSnapshot {
  readonly notifications: OperationOutputFor<'notification.notifications.read'>;
  readonly preferences: OperationOutputFor<'notification.preferences.read'>;
}

function notification(value: unknown): NotificationSnapshot {
  return value as NotificationSnapshot;
}
