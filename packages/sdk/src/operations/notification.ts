// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const NOTIFICATION_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "notification.notifications.read",
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
  readonly preferencesRead: OperationMethod<"notification.preferences.read">;
  readonly preferencesManage: OperationMethod<"notification.preferences.manage">;
  readonly endpointsManage: OperationMethod<"notification.endpoints.manage">;
  readonly templatesManage: OperationMethod<"notification.templates.manage">;
  readonly templatesRead: OperationMethod<"notification.templates.read">;
  readonly announcementsRead: OperationMethod<"notification.announcements.read">;
  readonly announcementsManage: OperationMethod<"notification.announcements.manage">;
}

export function createFetchNotification(baseUrl: string): NotificationOperations {
  return createNotificationOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createNotificationOperations(client: OperationExecutor): NotificationOperations {
  return Object.freeze({
    notificationsRead: bindNotificationsRead(client),
    preferencesRead: bindPreferencesRead(client),
    preferencesManage: bindPreferencesManage(client),
    endpointsManage: bindEndpointsManage(client),
    templatesManage: bindTemplatesManage(client),
    templatesRead: bindTemplatesRead(client),
    announcementsRead: bindAnnouncementsRead(client),
    announcementsManage: bindAnnouncementsManage(client),
  });
}

export function createFetchNotificationNotificationsRead(baseUrl: string): OperationMethod<"notification.notifications.read"> {
  return bindNotificationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindNotificationsRead(client: OperationExecutor): OperationMethod<"notification.notifications.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.notifications.read","method":"GET","path":"/api/v1/notifications","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchNotificationPreferencesRead(baseUrl: string): OperationMethod<"notification.preferences.read"> {
  return bindPreferencesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPreferencesRead(client: OperationExecutor): OperationMethod<"notification.preferences.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.preferences.read","method":"GET","path":"/api/v1/notifications/preferences","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchNotificationPreferencesManage(baseUrl: string): OperationMethod<"notification.preferences.manage"> {
  return bindPreferencesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPreferencesManage(client: OperationExecutor): OperationMethod<"notification.preferences.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.preferences.manage","method":"PUT","path":"/api/v1/notifications/preferences/{channel}/{eventtype}","audience":"member","idempotent":true,"pathKeys":["channel","eventtype"]}));
}

export function createFetchNotificationEndpointsManage(baseUrl: string): OperationMethod<"notification.endpoints.manage"> {
  return bindEndpointsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindEndpointsManage(client: OperationExecutor): OperationMethod<"notification.endpoints.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.endpoints.manage","method":"PUT","path":"/api/v1/notifications/endpoints/{channel}","audience":"member","idempotent":true,"pathKeys":["channel"]}));
}

export function createFetchNotificationTemplatesManage(baseUrl: string): OperationMethod<"notification.templates.manage"> {
  return bindTemplatesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesManage(client: OperationExecutor): OperationMethod<"notification.templates.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.templates.manage","method":"PUT","path":"/api/v1/notifications/templates/{templateid}","audience":"operator","idempotent":true,"pathKeys":["templateid"]}));
}

export function createFetchNotificationTemplatesRead(baseUrl: string): OperationMethod<"notification.templates.read"> {
  return bindTemplatesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesRead(client: OperationExecutor): OperationMethod<"notification.templates.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.templates.read","method":"GET","path":"/api/v1/notifications/templates","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchNotificationAnnouncementsRead(baseUrl: string): OperationMethod<"notification.announcements.read"> {
  return bindAnnouncementsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAnnouncementsRead(client: OperationExecutor): OperationMethod<"notification.announcements.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.announcements.read","method":"GET","path":"/api/v1/notifications/announcements","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchNotificationAnnouncementsManage(baseUrl: string): OperationMethod<"notification.announcements.manage"> {
  return bindAnnouncementsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAnnouncementsManage(client: OperationExecutor): OperationMethod<"notification.announcements.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"notification.announcements.manage","method":"PUT","path":"/api/v1/notifications/announcements/{announcementid}","audience":"operator","idempotent":true,"pathKeys":["announcementid"]}));
}
