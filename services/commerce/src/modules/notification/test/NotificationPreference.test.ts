import { describe, expect, it, vi } from 'vitest';
import type { WriteHandlerContext } from '../../../foundation/application/HandlerContext';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { PreferencesManageHandler } from '../application/handler/PreferencesManageHandler';
import type { NotificationRepository } from '../application/port/NotificationRepository';

describe('notification preference command', () => {
  it('persists consent source, quiet hours and the observed optimistic version', async () => {
    const transaction = {} as WriteTransactionContext;
    const changePreference = vi.fn(async () => ({ member_id: 'member:one', channel: 'email', event_type: 'order.paid', enabled: true,
      updated_at: '2026-09-05T00:00:00Z', authorization_state: 'unknown', authorized_at: null, consent_source: 'member',
      quiet_start: '22:00:00', quiet_end: '07:00:00', quiet_timezone: 'Asia/Shanghai', version: 3 }));
    const repository = { member: vi.fn(async () => ({ member: 'member:one', organization: 'mall:one' })), changePreference } as unknown as NotificationRepository;
    const handler = new PreferencesManageHandler(repository);

    await handler.execute({ path: { channel: 'email', eventtype: 'order.paid' }, query: {}, body: {
      enabled: true, quietHours: { start: '22:00', end: '07:00', timezone: 'Asia/Shanghai' },
    } } as never, context(transaction, 2));

    expect(changePreference).toHaveBeenCalledWith(transaction, 'member:one', 'mall:one', 'email', 'order.paid', true, 'unknown', 'member',
      { start: '22:00', end: '07:00', timezone: 'Asia/Shanghai' }, 2);
  });

  it('uses version zero for the first preference write', async () => {
    const transaction = {} as WriteTransactionContext;
    const changePreference = vi.fn(async () => ({ member_id: 'member:one', channel: 'email', event_type: 'order.paid', enabled: true,
      updated_at: '2026-09-05T00:00:00Z', authorization_state: 'unknown', authorized_at: null, consent_source: 'member',
      quiet_start: null, quiet_end: null, quiet_timezone: null, version: 1 }));
    const repository = { member: vi.fn(async () => ({ member: 'member:one', organization: 'mall:one' })), changePreference } as unknown as NotificationRepository;
    const handler = new PreferencesManageHandler(repository);

    await handler.execute({ path: { channel: 'email', eventtype: 'order.paid' }, query: {}, body: { enabled: true } } as never,
      context(transaction, undefined));

    expect(changePreference).toHaveBeenCalledWith(transaction, 'member:one', 'mall:one', 'email', 'order.paid', true, 'unknown', 'member', null, 0);
  });
});

function context(transaction: WriteTransactionContext, expectedVersion: number | undefined): WriteHandlerContext<'notification.preferences.manage'> {
  return {
    requestId: 'request:one', traceId: 'trace:one', deadline: Date.now() + 1_000, signal: new AbortController().signal,
    operation: 'notification.preferences.manage', headers: {}, rawBody: '', idempotencyKey: 'preference:one',
    ...(expectedVersion === undefined ? {} : { expectedVersion }), transaction,
    security: { kind: 'session', access: {
      actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['notification.preference.manage']), denies: new Set() }, scopes: [] },
      organization: 'mall:one', scope: { id: 'self:principal:one', kind: 'self', path: [] }, accessVersion: 1,
      roles: [], capabilities: new Set(['notification.preferences.manage']), capabilityVersion: 1, assurance: { level: 1 }, trace: 'trace:one',
    } },
  };
}
