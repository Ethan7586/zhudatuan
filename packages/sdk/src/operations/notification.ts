// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const NOTIFICATION_OPERATION_IDS = Object.freeze([
  "notification.notifications.read",
  "notification.notifications.ack",
  "notification.preferences.read",
  "notification.preferences.manage",
  "notification.endpoints.manage",
  "notification.templates.manage",
  "notification.templates.read",
  "notification.announcements.read",
  "notification.announcements.manage",
] as const satisfies readonly OperationId[]);

export interface NotificationOperations {
  readonly notificationsRead: OperationMethod<"notification.notifications.read">;
  readonly notificationsAck: OperationMethod<"notification.notifications.ack">;
  readonly preferencesRead: OperationMethod<"notification.preferences.read">;
  readonly preferencesManage: OperationMethod<"notification.preferences.manage">;
  readonly endpointsManage: OperationMethod<"notification.endpoints.manage">;
  readonly templatesManage: OperationMethod<"notification.templates.manage">;
  readonly templatesRead: OperationMethod<"notification.templates.read">;
  readonly announcementsRead: OperationMethod<"notification.announcements.read">;
  readonly announcementsManage: OperationMethod<"notification.announcements.manage">;
}

export function createFetchNotification(baseUrl: string): NotificationOperations { return createNotificationOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createNotificationOperations(client: OperationExecutor): NotificationOperations { return Object.freeze({
    notificationsRead: bindNotificationsRead(client),
    notificationsAck: bindNotificationsAck(client),
    preferencesRead: bindPreferencesRead(client),
    preferencesManage: bindPreferencesManage(client),
    endpointsManage: bindEndpointsManage(client),
    templatesManage: bindTemplatesManage(client),
    templatesRead: bindTemplatesRead(client),
    announcementsRead: bindAnnouncementsRead(client),
    announcementsManage: bindAnnouncementsManage(client),
  }); }

export function createFetchNotificationNotificationsRead(baseUrl: string): OperationMethod<"notification.notifications.read"> { return bindNotificationsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindNotificationsRead(client: OperationExecutor): OperationMethod<"notification.notifications.read"> { return bindOperation(client, defineOperation({"id":"notification.notifications.read","method":"GET","path":"/api/v1/notifications","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchNotificationNotificationsAck(baseUrl: string): OperationMethod<"notification.notifications.ack"> { return bindNotificationsAck(new ApiClient(baseUrl, new FetchTransport())); }

function bindNotificationsAck(client: OperationExecutor): OperationMethod<"notification.notifications.ack"> { return bindOperation(client, defineOperation({"id":"notification.notifications.ack","method":"PUT","path":"/api/v1/notifications/{notificationid}/ack","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchNotificationPreferencesRead(baseUrl: string): OperationMethod<"notification.preferences.read"> { return bindPreferencesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindPreferencesRead(client: OperationExecutor): OperationMethod<"notification.preferences.read"> { return bindOperation(client, defineOperation({"id":"notification.preferences.read","method":"GET","path":"/api/v1/notifications/preferences","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchNotificationPreferencesManage(baseUrl: string): OperationMethod<"notification.preferences.manage"> { return bindPreferencesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPreferencesManage(client: OperationExecutor): OperationMethod<"notification.preferences.manage"> { return bindOperation(client, defineOperation({"id":"notification.preferences.manage","method":"PUT","path":"/api/v1/notifications/preferences/{channel}/{eventtype}","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchNotificationEndpointsManage(baseUrl: string): OperationMethod<"notification.endpoints.manage"> { return bindEndpointsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindEndpointsManage(client: OperationExecutor): OperationMethod<"notification.endpoints.manage"> { return bindOperation(client, defineOperation({"id":"notification.endpoints.manage","method":"PUT","path":"/api/v1/notifications/endpoints/{channel}","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchNotificationTemplatesManage(baseUrl: string): OperationMethod<"notification.templates.manage"> { return bindTemplatesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesManage(client: OperationExecutor): OperationMethod<"notification.templates.manage"> { return bindOperation(client, defineOperation({"id":"notification.templates.manage","method":"PUT","path":"/api/v1/notifications/templates/{templateid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchNotificationTemplatesRead(baseUrl: string): OperationMethod<"notification.templates.read"> { return bindTemplatesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesRead(client: OperationExecutor): OperationMethod<"notification.templates.read"> { return bindOperation(client, defineOperation({"id":"notification.templates.read","method":"GET","path":"/api/v1/notifications/templates","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchNotificationAnnouncementsRead(baseUrl: string): OperationMethod<"notification.announcements.read"> { return bindAnnouncementsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAnnouncementsRead(client: OperationExecutor): OperationMethod<"notification.announcements.read"> { return bindOperation(client, defineOperation({"id":"notification.announcements.read","method":"GET","path":"/api/v1/notifications/announcements","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchNotificationAnnouncementsManage(baseUrl: string): OperationMethod<"notification.announcements.manage"> { return bindAnnouncementsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindAnnouncementsManage(client: OperationExecutor): OperationMethod<"notification.announcements.manage"> { return bindOperation(client, defineOperation({"id":"notification.announcements.manage","method":"PUT","path":"/api/v1/notifications/announcements/{announcementid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }
