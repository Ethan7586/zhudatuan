import { describe, expect, it, vi } from 'vitest';
import type { CommitContext, FinalizeContext } from '../../../foundation/application/HandlerContext';
import { DomainError } from '../../../foundation/domain/DomainError';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import { authorizationEvidence } from '../../../foundation/security/AuthorizationEvidence';
import type { ObjectStore } from '../../runtime/public/ObjectPort';
import { result, transactionManager, withWriteTransaction } from '../../../test/TransactionFixture';
import type { ExportPort, RuntimeExportRecord, RuntimeExportWork } from '../../runtime/public';
import type { TaskAuthorizationPort } from '../../access/public';
import { ExportsGetHandler } from '../application/handler/ExportsGetHandler';

const input = { path: { exportid: 'export:test' } };
type Context = CommitContext<'voucher.exports.get'>;

describe('voucher export download authorization', () => {
  it('checks original export authorization twice and never signs inside a transaction', async () => {
    const data = fixture();
    const committed = await data.commit();
    expect(data.objects.authorize).not.toHaveBeenCalled();
    const reply = await data.finalize(committed.checkpoint);
    expect(reply.body.downloadToken).toBe('https://objects.example.test/download');
    expect(JSON.stringify(reply.body)).not.toContain('private/reference');
    expect(data.assert).toHaveBeenCalledTimes(2);
    expect(data.objects.authorize).toHaveBeenCalledWith('private/reference', expect.any(Number));
    const seconds = data.authorize.mock.calls[0]![1];
    expect(seconds).toBeGreaterThanOrEqual(60);
    expect(seconds).toBeLessThanOrEqual(120);
  });

  it.each(['actor', 'membership', 'scope'] as const)('denies another %s before consuming a download', async field => {
    const data = fixture({ evidence: { [field]: `${field}:other` } });
    await expect(data.commit()).rejects.toThrow('AUTHORIZATION_DENIED');
    expect(data.take).not.toHaveBeenCalled();
    expect(data.authorize).not.toHaveBeenCalled();
  });

  it('requires fresh step-up before downloading plaintext credentials', async () => {
    const data = fixture({ level: 2 });
    await expect(data.commit()).rejects.toThrow('STEPUP_REQUIRED');
    expect(data.take).not.toHaveBeenCalled();
  });

  it('can poll a queued export without an unnecessary new step-up', async () => {
    const data = fixture({ level: 2, state: 'queued' });
    const committed = await data.commit();
    expect((await data.finalize(committed.checkpoint)).body.state).toBe('queued');
    expect(data.take).not.toHaveBeenCalled();
    expect(data.authorize).not.toHaveBeenCalled();
  });

  it('reauthorizes checkpoint recovery and denies permissions revoked after commit', async () => {
    const data = fixture();
    const committed = await data.commit();
    data.assert.mockRejectedValueOnce(new DomainError('AUTHORIZATION_DENIED'));
    await expect(data.finalize(committed.checkpoint)).rejects.toThrow('AUTHORIZATION_DENIED');
    expect(data.authorize).not.toHaveBeenCalled();
  });

  it('does not consume a token too close to file expiration', async () => {
    const data = fixture({ remaining: 30_000 });
    const committed = await data.commit();
    expect((await data.finalize(committed.checkpoint)).body.downloadToken).toBeUndefined();
    expect(data.take).not.toHaveBeenCalled();
  });

  it('refuses a signed URL which would outlive the file authorization', async () => {
    const data = fixture();
    const committed = await data.commit();
    data.authorize.mockResolvedValueOnce({ url: 'https://objects.example.test/long', expiresAt: new Date(Date.now() + 600_000).toISOString() });
    await expect(data.finalize(committed.checkpoint)).rejects.toThrow('VOUCHER_EXPORT_NOT_READY');
  });
});

function fixture(options: { evidence?: Readonly<Record<string, unknown>>; level?: number; state?: RuntimeExportRecord['state']; remaining?: number } = {}) {
  const access = { actor: { id: 'actor:test', membership: 'membership:test', target: 'console', credentialVersion: 1 },
    scope: { id: 'scope:test' }, organization: 'organization:test', accessVersion: 1, capabilityVersion: 1,
    assurance: { level: options.level ?? 3, verified: new Date() } } as AccessContext;
  const record: RuntimeExportRecord = { id: 'export:test', kind: 'credential', state: options.state ?? 'completed',
    expiresAt: new Date(Date.now() + (options.remaining ?? 120_000)).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const work: RuntimeExportWork = { id: record.id, kind: record.kind, scope: access.scope.id, snapshot: {},
    authorization: { ...authorizationEvidence(access, 'voucher.credentialexports.create', new Date()), reason: '凭证交付', ...options.evidence } };
  const take = vi.fn(async () => ({ record, reference: 'private/reference' }));
  const exports = { work: vi.fn(async () => work), read: vi.fn(async () => record), take } as unknown as ExportPort;
  const assert = vi.fn<TaskAuthorizationPort['assert']>(async () => undefined);
  let inTransaction = false;
  const authorize = vi.fn(async (_reference: string, _seconds: number) => {
    expect(inTransaction).toBe(false);
    return { url: 'https://objects.example.test/download', expiresAt: new Date(Date.now() + 60_000).toISOString() };
  });
  const objects = { authorize } as unknown as ObjectStore;
  const query = async () => result([]);
  const manager = transactionManager(query);
  const handler = new ExportsGetHandler(exports, objects, { assert: async (transaction, evidence) => {
    inTransaction = true;
    try { await assert(transaction, evidence); } finally { inTransaction = false; }
  } }, manager);
  const context = { security: { kind: 'session', access }, operation: 'voucher.exports.get', traceId: 'trace:test',
    signal: new AbortController().signal, deadline: Date.now() + 10_000 } as Context;
  return { assert, take, objects, authorize,
    commit: () => withWriteTransaction(query, transaction => handler.commit(input, null, { ...context, transaction })),
    finalize: (checkpoint: Awaited<ReturnType<ExportsGetHandler['commit']>>['checkpoint']) => handler.finalize(input, checkpoint, context as unknown as FinalizeContext<'voucher.exports.get'>) };
}
