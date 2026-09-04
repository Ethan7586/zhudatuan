import { describe, expect, it, vi } from 'vitest';
import type { HandlerContext, WriteHandlerContext } from '../../../foundation/application/HandlerContext';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { TemplatesManageHandler } from '../application/handler/TemplatesManageHandler';
import { TemplatesReadHandler } from '../application/handler/TemplatesReadHandler';
import type { NotificationRepository } from '../application/port/NotificationRepository';

describe('notification template management', () => {
  it('applies the requested channel inside the repository query', async () => {
    const transaction = {} as ReadTransactionContext;
    const templates = vi.fn(async () => []);
    const handler = new TemplatesReadHandler({ templates } as unknown as NotificationRepository);
    await handler.execute({ path: {}, query: { channel: 'sms', limit: 50 } } as never, context('notification.templates.read', transaction));
    expect(templates).toHaveBeenCalledExactlyOnceWith(transaction, 'mall:one', 'sms', null, 51);
  });

  it('passes the optimistic version to immutable template persistence', async () => {
    const transaction = {} as WriteTransactionContext;
    const saveTemplate = vi.fn(async (_transaction, value) => ({ ...value, createdAt: '2026-09-03T00:00:00.000Z', matches: true, inserted: false }));
    const handler = new TemplatesManageHandler({ saveTemplate } as unknown as NotificationRepository);
    const result = await handler.execute(
      {
        path: { templateid: 'template:one' },
        query: {},
        body: { channel: 'sms', eventType: 'identity.challenge', version: 2, variables: { code: 'string' }, providerTemplate: 'SMS_100', subject: null, body: '验证码 {{code}}', status: 'active' },
      } as never,
      { ...context('notification.templates.manage', transaction), expectedVersion: 2 } as WriteHandlerContext<'notification.templates.manage'>
    );
    expect(saveTemplate).toHaveBeenCalledWith(transaction, expect.objectContaining({ id: 'template:one', scopeId: 'mall:one', expectedVersion: 2 }));
    expect(result).toMatchObject({ status: 200, body: { status: 'active', version: 2 } });
  });
});

function context<TKey extends 'notification.templates.read' | 'notification.templates.manage'>(
  operation: TKey,
  transaction: TKey extends 'notification.templates.manage' ? WriteTransactionContext : ReadTransactionContext
): TKey extends 'notification.templates.manage' ? WriteHandlerContext<TKey> : HandlerContext<TKey> {
  return {
    requestId: 'request:one',
    traceId: 'trace:one',
    deadline: Date.now() + 1000,
    signal: new AbortController().signal,
    operation,
    headers: {},
    rawBody: '',
    idempotencyKey: 'notification:one',
    transaction,
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['notification.template.read', 'notification.template.manage']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'mall:one', kind: 'mall', path: [] },
        accessVersion: 1,
        capabilities: new Set([operation]),
        capabilityVersion: 1,
        assurance: { level: 3 },
        trace: 'trace:one',
      },
    },
  } as never;
}
