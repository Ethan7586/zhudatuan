import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../foundation/application/OperationExecution';
import type { OperationAction } from '../../foundation/application/ModuleOperations';
import { getNotificationsOperations } from './application/query/GetNotifications';

describe('notification member receipt', () => {
  it('reads storefront visibility without organization-wide dispatches', async () => {
    const notifications = vi.fn(async () => ({ rows: [{ id: 'dispatch:one', kind: 'dispatch', created_at: new Date('2026-08-31T01:00:00Z') }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] }));
    const action = getNotificationsOperations(() => ({ notifications }) as never)['notification.notifications.read']! as OperationAction;
    const result = await action(request('notification.notifications.read'), {} as never);
    expect(notifications).toHaveBeenCalledWith('membership:one', false, null, null, 51);
    expect(result).toMatchObject({ status: 200, body: { count: 1 } });
  });

  it('creates an idempotent receipt for a visible message', async () => {
    const acknowledge = vi.fn(async () => ({ rows: [{ id: 'dispatch:one', readAt: new Date('2026-08-31T01:02:00Z') }], rowCount: 1, command: 'INSERT', oid: 0, fields: [] }));
    const action = getNotificationsOperations(() => ({ acknowledge }) as never)['notification.notifications.ack']! as OperationAction;
    const result = await action(request('notification.notifications.ack', { notificationid: 'dispatch:one' }), {} as never);
    expect(acknowledge).toHaveBeenCalledWith('membership:one', 'dispatch:one');
    expect(result).toMatchObject({ status: 200, body: { id: 'dispatch:one' } });
  });
});

function request(type: OperationRequest['type'], path: Readonly<Record<string, string>> = {}): OperationRequest {
  return {
    type,
    input: {
      path,
      query: {},
      headers: { 'x-peer-address': '127.0.0.1', 'user-agent': 'test' },
      body: type.endsWith('.ack') ? {} : undefined,
      rawBody: '',
      idempotency: 'notification:one',
      deadline: Date.now() + 1000,
      signal: new AbortController().signal,
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['notification.read', 'notification.ack']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'self:principal:one', kind: 'self', path: [] },
        accessVersion: 1,
        capabilities: new Set([type]),
        capabilityVersion: 1,
        assurance: { level: 1 },
        trace: 'trace:one',
      },
    },
  };
}
