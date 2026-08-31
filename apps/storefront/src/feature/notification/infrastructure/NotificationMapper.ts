import type { OperationOutputFor } from '@shop/contract';
import type { NotificationPage } from '../model/Notification';
import type { NotificationPreference } from '../model/NotificationPreference';

export function mapNotifications(value: OperationOutputFor<'notification.notifications.read'>): NotificationPage {
  return Object.freeze({
    items: Object.freeze(
      value.items.map((item) =>
        Object.freeze({
          id: item.id,
          kind: item.kind,
          eventType: item.event_type,
          channel: item.channel,
          subject: item.subject,
          body: item.body,
          state: item.state,
          createdAt: item.created_at,
          readAt: item.read_at,
        })
      )
    ),
    nextCursor: value.nextCursor ?? null,
  });
}

export function mapPreferences(value: OperationOutputFor<'notification.preferences.read'>): readonly NotificationPreference[] {
  return Object.freeze(
    value.items.map((item) =>
      Object.freeze({
        channel: item.channel,
        eventType: item.event_type,
        providerTemplate: item.provider_template,
        enabled: item.enabled,
        authorization: item.authorization_state,
        authorizedAt: item.authorized_at,
      })
    )
  );
}
