import { describe, expect, it, vi } from 'vitest';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import type { AuditHistoryRepository } from '../port/AuditHistoryRepository';
import { RecordsReadHandler } from './RecordsReadHandler';

const row = Object.freeze({
  id: 'audit:one',
  kind: 'command',
  scope_id: 'mall:one',
  actor_id: 'actor:secret',
  actor_type: 'console',
  request_id: 'request:secret',
  operation: 'catalog.listings.publish',
  subject_type: 'actor',
  subject_id: 'actor:secret',
  object_type: 'catalog',
  object_id: 'listing:secret',
  outcome: 'succeeded',
  reason: 'http:200',
  before_hash: null,
  after_hash: 'a'.repeat(64),
  evidence: { decision: 'approved' },
  trace_id: 'trace:secret',
  previous_hash: null,
  record_hash: 'b'.repeat(64),
  occurred_at: '2026-09-06T01:00:00.000Z',
});

describe('RecordsReadHandler', () => {
  it('masks sensitive fields in summary mode and carries one watermark through the cursor', async () => {
    const records = vi
      .fn<AuditHistoryRepository['records']>()
      .mockResolvedValueOnce([row, { ...row, id: 'audit:two' }])
      .mockResolvedValueOnce([]);
    const access = vi.fn();
    const handler = new RecordsReadHandler({ records }, { record: vi.fn(), access });
    await withWriteTransaction(
      async () => result([]),
      async (transaction) => {
        const first = await handler.execute({ query: { limit: 1 } } as never, context(transaction, 2));
        expect(first.body.items[0]).toMatchObject({ actor_id: '····cret', request_id: null, object_id: '····cret', evidence: null, trace_id: null });
        expect(first.body.detail).toBe('summary');
        expect(first.body.next).toEqual(expect.any(String));
        await handler.execute({ query: { limit: 1, cursor: first.body.next! } } as never, context(transaction, 2));
        expect(records.mock.calls[1]?.[3]).toBe(first.body.watermark);
      },
      'audit.records.read'
    );
    expect(access).not.toHaveBeenCalled();
  });

  it('requires step-up and appends an access fact for evidence fields', async () => {
    const records = vi.fn<AuditHistoryRepository['records']>().mockResolvedValue([row]);
    const access = vi.fn();
    const handler = new RecordsReadHandler({ records }, { record: vi.fn(), access });
    await withWriteTransaction(
      async () => result([]),
      async (transaction) => {
        await expect(handler.execute({ query: { detail: 'evidence' } } as never, context(transaction, 2))).rejects.toMatchObject({ code: 'STEPUP_REQUIRED' });
        const response = await handler.execute({ query: { detail: 'evidence' } } as never, context(transaction, 3));
        expect(response.body.items[0]).toMatchObject({ actor_id: 'actor:secret', request_id: 'request:secret', evidence: { decision: 'approved' }, trace_id: 'trace:secret' });
      },
      'audit.records.read'
    );
    expect(access).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation: 'audit.records.read', reason: 'sensitive-evidence-read' }));
  });
});

function context(transaction: HandlerContext<'audit.records.read'>['transaction'], assurance: number): HandlerContext<'audit.records.read'> {
  return {
    requestId: 'request:query',
    traceId: 'trace:query',
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
    operation: 'audit.records.read',
    headers: {},
    rawBody: '',
    transaction,
    security: {
      kind: 'session',
      access: {
        actor: { id: 'actor:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: assurance } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['audit.read']), denies: new Set() }, scopes: [] },
        roles: [],
        organization: 'organization:one',
        scope: { id: 'mall:one', kind: 'mall', path: [] },
        accessVersion: 1,
        capabilities: new Set(['audit.records.read']),
        capabilityVersion: 1,
        assurance: { level: assurance },
        trace: 'trace:query',
      },
    },
  };
}
