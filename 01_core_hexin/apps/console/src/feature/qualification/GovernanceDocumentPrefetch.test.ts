// @vitest-environment jsdom

import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ qualificationsRead: vi.fn(), templatesRead: vi.fn(), announcementsRead: vi.fn() }));
vi.mock('@shop/sdk/qualification', async (importOriginal) => ({
  ...await importOriginal<typeof import('@shop/sdk/qualification')>(),
  createFetchQualificationCenterRead: () => api.qualificationsRead,
}));
vi.mock('@shop/sdk/notification', async (importOriginal) => ({
  ...await importOriginal<typeof import('@shop/sdk/notification')>(),
  createFetchNotificationTemplatesRead: () => api.templatesRead,
  createFetchNotificationAnnouncementsRead: () => api.announcementsRead,
}));

import { readNotificationRecords } from '../notification/NotificationQuery';
import { readQualifications } from './QualificationQuery';

const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['qualification.center.read', 'notification.templates.read', 'notification.announcements.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-14T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleQualificationPrefetch;
  delete window.__consoleNotificationPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.qualificationsRead.mockReset();
  api.templatesRead.mockReset();
  api.announcementsRead.mockReset();
});

describe('governance document prefetch', () => {
  it('hydrates qualification data without repeating its SDK read', async () => {
    window.__consoleQualificationPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: { items: [], count: 0 },
    });

    await expect(readQualifications(context, undefined, new AbortController().signal))
      .resolves.toEqual({ items: [], count: 0 });
    expect(api.qualificationsRead).not.toHaveBeenCalled();
  });

  it('hydrates the exact notification view without repeating its SDK read', async () => {
    window.__consoleNotificationPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, view: 'templates', value: { items: [], count: 0 },
    });

    await expect(readNotificationRecords(context, 'templates', undefined, new AbortController().signal))
      .resolves.toEqual({ items: [], count: 0 });
    expect(api.templatesRead).not.toHaveBeenCalled();
  });

  it('rejects a prefetched notification page for another view', async () => {
    window.__consoleNotificationPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, view: 'templates', value: { items: [], count: 0 },
    });
    api.announcementsRead.mockResolvedValue({ items: [], count: 0 });

    await readNotificationRecords(context, 'announcements', undefined, new AbortController().signal);
    expect(api.announcementsRead).toHaveBeenCalledOnce();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
