import { createFetchNotificationAnnouncementsRead, createFetchNotificationTemplatesRead } from '@shop/sdk/notification';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consumeDocumentPrefetch } from '../../shared/api/DocumentPrefetch';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { AnnouncementPageSchema, NotificationTemplatePageSchema,
  type NotificationRecordPage, type NotificationView } from './NotificationSchema';

const templatesRead = createFetchNotificationTemplatesRead(appConfig.apiBaseUrl);
const announcementsRead = createFetchNotificationAnnouncementsRead(appConfig.apiBaseUrl);

export const notificationViews = ['templates', 'announcements'] as const;
export const NOTIFICATION_STALE_TIME_MS = 30_000;
export const notificationKey = (context: ConsoleContext, view: NotificationView, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion,
  view === 'templates' ? 'notification.templates.read' : 'notification.announcements.read', cursor ?? null, 50,
] as const);
export async function readNotificationRecords(context: ConsoleContext, view: NotificationView, cursor: string | undefined,
  signal: AbortSignal): Promise<NotificationRecordPage> {
  const prefetched = await takeDocumentNotificationPrefetch(context, view, cursor, signal);
  const input = { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  if (view === 'templates') {
    const page = NotificationTemplatePageSchema.parse(prefetched ?? await templatesRead(input, request));
    return pageResult(page.items.map((row) => ({ id: row.id, title: row.subject ?? row.event_type, channel: row.channel,
      state: row.status, startsAt: row.created_at, endsAt: null, version: row.version })), page);
  }
  const page = AnnouncementPageSchema.parse(prefetched ?? await announcementsRead(input, request));
  return pageResult(page.items.map((row) => ({ id: row.id, title: row.title, channel: '公告', state: row.state,
    startsAt: row.starts_at, endsAt: row.ends_at, version: row.version })), page);
}

async function takeDocumentNotificationPrefetch(context: ConsoleContext, view: NotificationView, cursor: string | undefined,
  signal: AbortSignal): Promise<unknown> {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleNotificationPrefetch;
  delete window.__consoleNotificationPrefetch;
  const value = await consumeDocumentPrefetch(slot, signal);
  const matches = value?.scopeKind === context.scope.kind
    && value.scopeId === context.scope.id
    && value.accessVersion === context.session.accessVersion
    && value.view === view
    && value.cursor === cursor;
  return matches ? value.value : undefined;
}

function pageResult(items: NotificationRecordPage['items'], page: Readonly<{ count: number; nextCursor?: string | undefined }>): NotificationRecordPage {
  return Object.freeze({ items: Object.freeze(items), count: page.count,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}
