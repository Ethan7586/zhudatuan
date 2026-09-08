import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { OperationCatalog } from '@shop/contract';
import { PgTransactionAccess } from '../../../platform/database/PgTransactionAccess';
import { AuditDecorator } from '../../../pipeline/AuditDecorator';
import type { ExecutionContext } from '../../../pipeline/HandlerContext';
import { OperationExecutor } from '../../../pipeline/OperationExecutor';
import { executionRequestHash } from '../../../pipeline/OperationHash';
import type { AccessContext } from '../../../platform/security/AccessContext';
import { result, transactionManager } from '../../../test/TransactionFixture';
import { PgMakerCheckerGuard } from '../../access/infrastructure/persistence/PgMakerCheckerGuard';
import { CredentialExportsCreateHandler } from '../application/handler/CredentialExportsCreateHandler';

const operation = 'voucher.credentialexports.create';
const input = { body: { pool: 'pool:one', reason: '凭证交付', watermark: '2026-09-05T01:00:00.000Z' } };
const receipt = { status: 202, body: { id: 'export:one', kind: 'credential', state: 'queued' as const, expiresAt: '2026-09-06T01:00:00.000Z', createdAt: '2026-09-05T01:00:00.000Z', updatedAt: '2026-09-05T01:00:00.000Z' } };

describe('credential export maker/checker entry boundary', () => {
  it('consumes the exact request, pool version, scope and maker binding before calling the export application', async () => {
    const data = fixture();
    expect(OperationCatalog.get(operation)).toMatchObject({ makerChecker: true, assuranceLevel: 'stepup', idempotencyPolicy: 'required' });
    expect(await data.execute()).toEqual(receipt);
    expect(data.query).toHaveBeenCalledWith(expect.stringContaining('access.consume_action_proof'), [
      createHash('sha256').update('a'.repeat(43)).digest(),
      operation,
      'scope:test',
      executionRequestHash(operation, input, 4),
      4,
      'console',
      'scope:test',
      'membership:maker',
      'voucher.credential.export',
    ]);
    expect(data.query.mock.invocationCallOrder[0]).toBeLessThan(data.application.mock.invocationCallOrder[0]!);
    expect(data.complete).toHaveBeenCalledOnce();
  });

  it.each(['ACTION_PROOF_INVALID', 'ACTION_PROOF_REPLAYED', 'MAKER_CHECKER_SEPARATION_REQUIRED'])('never creates or queues an export after %s', async (code) => {
    const data = fixture();
    data.query.mockRejectedValueOnce(new Error(code));
    await expect(data.execute()).rejects.toThrow(code);
    expect(data.application).not.toHaveBeenCalled();
    expect(data.complete).not.toHaveBeenCalled();
  });

  it('rejects a missing proof and a checker matching the maker', async () => {
    const data = fixture();
    await expect(data.execute(false)).rejects.toThrow('ACTION_PROOF_INVALID');
    expect(data.query).not.toHaveBeenCalled();
    data.query.mockResolvedValueOnce(result([{ proof_id: 'proof:one', checker_membership_id: 'membership:maker' }]));
    await expect(data.execute()).rejects.toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
    expect(data.application).not.toHaveBeenCalled();
  });

  it('replays the committed receipt without consuming another proof or creating another export', async () => {
    const data = fixture();
    data.claim.mockResolvedValueOnce({ state: 'completed', response: receipt });
    expect(await data.execute()).toEqual(receipt);
    expect(data.query).not.toHaveBeenCalled();
    expect(data.application).not.toHaveBeenCalled();
  });
});

function fixture() {
  const query = vi.fn(async () => result([{ proof_id: 'proof:one', checker_membership_id: 'membership:checker' }]));
  const application = vi.fn(async () => receipt);
  const complete = vi.fn();
  const claim = vi.fn<import('../../../pipeline/IdempotencyRepository').IdempotencyRepository['claim']>(async () => ({ state: 'started' }));
  const executor = new OperationExecutor(transactionManager(query), { claim, complete, checkpoint: vi.fn() }, new PgMakerCheckerGuard(new PgTransactionAccess()), new AuditDecorator({ append: vi.fn() }), { append: vi.fn() });
  const access = {
    actor: { id: 'principal:maker', membership: 'membership:maker', target: 'console', credentialVersion: 1 },
    membership: { id: 'membership:maker' },
    scope: { id: 'scope:test', kind: 'platform' },
    organization: 'organization:test',
    accessVersion: 1,
    capabilityVersion: 1,
  } as AccessContext;
  const execution: ExecutionContext<typeof operation> = {
    operation,
    requestId: 'request:test',
    traceId: 'trace:test',
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
    headers: {},
    rawBody: '',
    idempotencyKey: 'export:key',
    expectedVersion: 4,
    security: { kind: 'session', access },
  };
  return {
    query,
    application,
    complete,
    claim,
    execute: (proof = true) => executor.execute(new CredentialExportsCreateHandler({ credentialexportsCreate: application }), input, { ...execution, ...(proof ? { actionProof: 'a'.repeat(43) } : {}) }),
  };
}
