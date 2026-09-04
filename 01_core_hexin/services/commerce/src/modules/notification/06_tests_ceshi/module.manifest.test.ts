import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CAPABILITIES, notificationManifest } from '..';

describe('notification module manifest', () => {
  it('keeps the stable notification identity and lightweight public entry', () => {
    expect(notificationManifest.id).toBe('notification');
    expect(notificationManifest.publicEntry).toBe('./index.ts');
    expect(notificationManifest.provides).toEqual([
      NOTIFICATION_CAPABILITIES.read,
      NOTIFICATION_CAPABILITIES.manage,
    ]);
  });

  it('declares notification dependencies, layers, and entrypoints', () => {
    expect(notificationManifest.requires).toEqual(['identity', 'order', 'support']);
    expect(notificationManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(notificationManifest.entrypoints.http).toEqual(['notificationRoutes', 'notificationOperatorReadOperations']);
    expect(notificationManifest.entrypoints.jobs).toEqual(['notification', 'identitynotification']);
  });

  it('declares the notification operation inventory', () => {
    expect(notificationManifest.operations).toEqual([
      'notification.notifications.read',
      'notification.preferences.read',
      'notification.preferences.manage',
      'notification.endpoints.manage',
      'notification.templates.manage',
      'notification.templates.read',
      'notification.announcements.read',
      'notification.announcements.manage',
    ]);
  });

  it('declares notification event ownership', () => {
    expect(notificationManifest.publishes).toEqual(['notification.delivered']);
    expect(notificationManifest.consumes).toHaveLength(33);
    expect(notificationManifest.consumes).toContain('payment.succeeded');
    expect(notificationManifest.consumes).toContain('extension.degraded');
  });
});
