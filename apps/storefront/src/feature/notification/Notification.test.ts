import { describe, expect, it } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { mapNotifications, mapPreferences } from './infrastructure/NotificationMapper';

describe('notification presentation', () => {
  it('preserves immutable message data and the separate read receipt', () => {
    const input: OperationOutputFor<'notification.notifications.read'> = {
      items: [{ id: 'dispatch:one', kind: 'dispatch', event_type: 'order.created', channel: 'inapp', subject: '订单已创建', body: '订单已进入处理流程', state: 'sent', created_at: '2026-08-31T01:00:00.000Z', read_at: null }],
      count: 1,
      nextCursor: 'next',
    };
    expect(mapNotifications(input)).toEqual({
      items: [{ id: 'dispatch:one', kind: 'dispatch', eventType: 'order.created', channel: 'inapp', subject: '订单已创建', body: '订单已进入处理流程', state: 'sent', createdAt: '2026-08-31T01:00:00.000Z', readAt: null }],
      nextCursor: 'next',
    });
  });

  it('maps published preferences without inventing browser defaults', () => {
    const input: OperationOutputFor<'notification.preferences.read'> = {
      items: [{ channel: 'wechat', event_type: 'order.created', provider_template: 'template:one', enabled: true, authorization_state: 'accepted', authorized_at: '2026-08-31T01:01:00.000Z', cursor_id: 'wechat:order.created' }],
      count: 1,
    };
    expect(mapPreferences(input)).toEqual([{ channel: 'wechat', eventType: 'order.created', providerTemplate: 'template:one', enabled: true, authorization: 'accepted', authorizedAt: '2026-08-31T01:01:00.000Z' }]);
  });
});
