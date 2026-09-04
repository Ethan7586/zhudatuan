import { describe, expect, it, vi } from 'vitest';
import type { WriteHandlerContext } from '../../../foundation/application/HandlerContext';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { DecisionsPreviewHandler } from '../application/handler/DecisionsPreviewHandler';
import { PoliciesManageHandler } from '../application/handler/PoliciesManageHandler';
import type { QualificationRepository } from '../application/port/QualificationRepository';

describe('qualification management', () => {
  it('preserves the real member decision simulator', async () => {
    const previewDecision = vi.fn(async () => [{ policy_id: 'policy:one', policy_version: 3, decision: 'eligible' as const }]);
    const handler = new DecisionsPreviewHandler({ previewDecision } as unknown as QualificationRepository);
    const result = await handler.execute({ path: {}, query: {}, body: { kind: 'decision', member: 'member:one', resource: 'listing:one' } } as never, context('qualification.decisions.preview'));
    expect(previewDecision).toHaveBeenCalledWith(transaction, 'mall:one', 'member:one', 'listing:one');
    expect(result.body).toEqual({ kind: 'decision', decisions: [{ policy_id: 'policy:one', policy_version: 3, decision: 'eligible' }] });
  });

  it('previews exact changed paths and conservative snapshot impact', async () => {
    const previewPolicy = vi.fn(async () => ({
      currentName: '员工策略', currentVersion: 3, currentRule: { effect: 'allow', requiredTags: ['employee'] }, currentHash: 'a'.repeat(64),
      sourceVersion: null, sourceRule: { effect: 'allow', requiredTags: ['employee'] }, sourceHash: 'a'.repeat(64), potentialProfiles: 120, resourceCount: 8, subjectCount: 2, limitCount: 4,
    }));
    const handler = new DecisionsPreviewHandler({ previewPolicy } as unknown as QualificationRepository);
    const result = await handler.execute({ path: {}, query: {}, body: { kind: 'publish', policy: 'policy:one', name: '员工策略', rule: { effect: 'allow', requiredTags: ['manager'] } } } as never, context('qualification.decisions.preview'));
    expect(result.body).toMatchObject({ kind: 'policy', impact: { current_version: 3, next_version: 4, changed_fields: ['requiredTags'], potential_profiles: 120, resource_count: 8 } });
  });

  it('passes optimistic versions to publish and append-only rollback', async () => {
    const publishPolicy = vi.fn(async (_transaction, value) => receipt(value.id, 'publish', null, 4));
    const rollbackPolicy = vi.fn(async (_transaction, value) => receipt(value.id, 'rollback', value.version, 4));
    const handler = new PoliciesManageHandler({ publishPolicy, rollbackPolicy } as unknown as QualificationRepository);
    await handler.execute({ path: { policyid: 'policy:one' }, query: {}, body: { action: 'publish', name: '员工策略', rule: { effect: 'allow' } } } as never, { ...context('qualification.policies.manage'), expectedVersion: 3 });
    await handler.execute({ path: { policyid: 'policy:one' }, query: {}, body: { action: 'rollback', version: 1 } } as never, { ...context('qualification.policies.manage'), expectedVersion: 3 });
    expect(publishPolicy).toHaveBeenCalledWith(transaction, expect.objectContaining({ id: 'policy:one', expectedVersion: 3, hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(rollbackPolicy).toHaveBeenCalledWith(transaction, expect.objectContaining({ id: 'policy:one', expectedVersion: 3, version: 1 }));
  });
});

const transaction = {} as WriteTransactionContext;
function receipt(id: string, action: 'publish' | 'rollback', source: number | null, active: number) {
  return { id, scope_id: 'mall:one', name: '员工策略', status: 'published' as const, active_version: active, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:01:00.000Z', rule_hash: 'a'.repeat(64), action, source_version: source };
}
function context<TKey extends 'qualification.decisions.preview' | 'qualification.policies.manage'>(operation: TKey): WriteHandlerContext<TKey> {
  return {
    requestId: 'request:one', traceId: 'trace:one', deadline: Date.now() + 1_000, signal: new AbortController().signal, operation,
    headers: {}, rawBody: '', idempotencyKey: 'qualification:one', transaction,
    security: { kind: 'session', access: {
      actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['qualification.preview', 'qualification.manage']), denies: new Set() }, scopes: [] },
      organization: 'mall:one', scope: { id: 'mall:one', kind: 'mall', path: [] }, accessVersion: 1, capabilities: new Set([operation]), capabilityVersion: 1, assurance: { level: 3 }, trace: 'trace:one',
    } },
  } as never;
}
