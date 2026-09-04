import { describe, expect, it, vi } from 'vitest';
import type { WriteHandlerContext } from '../../../foundation/application/HandlerContext';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { QualificationsPublishHandler } from '../application/handler/QualificationsPublishHandler';
import { QualificationsRevokeHandler } from '../application/handler/QualificationsRevokeHandler';
import { ExpireQualification } from '../application/process/ExpireQualification';
import type { QualificationCaseRecord, QualificationCaseRepository } from '../application/port/QualificationCaseRepository';
import type { QualificationCaseSnapshot } from '../domain/model/QualificationCase';

describe('qualification lifecycle', () => {
  it('verifies the stored digest before publication, persists once and schedules the exact expiry version', async () => {
    const save = vi.fn(async (_context, value: QualificationCaseSnapshot) => record(value));
    const cases = { find: vi.fn(), lock: vi.fn(async () => null), save } as unknown as QualificationCaseRepository;
    const inspect = vi.fn(async (reference: string) => ({ reference, sha256: 'a'.repeat(64), size: 128, scan: 'clean' as const, contentType: 'application/pdf', path: 'qualification/license.pdf' }));
    const schedule = vi.fn(async () => undefined);
    const handler = new QualificationsPublishHandler(cases, { inspect } as never, { schedule } as never);
    const input = {
      path: { qualificationid: 'qualification:one' }, query: {}, body: {
        title: '食品经营许可证', subject: { kind: 'partner', id: 'partner:one' }, applicability: [{ kind: 'category', id: 'category:food' }],
        effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: '2099-09-30T00:00:00.000Z',
        evidence: [{ id: 'evidence:one', kind: 'license', reference: 'object:license-one', sha256: 'a'.repeat(64) }],
      },
    } as never;
    const execution = context('qualification.qualifications.publish', 0);
    const prepared = await handler.prepare(input, execution, null);
    const committed = await handler.commit(input, prepared, execution);

    expect(inspect).toHaveBeenCalledWith('object:license-one');
    expect(save).toHaveBeenCalledWith(transaction, expect.objectContaining({ state: 'published', version: 1 }), 0);
    expect(schedule).toHaveBeenCalledWith(transaction, expect.objectContaining({ kind: 'qualificationexpiry', availableAt: '2099-09-30T00:00:00.000Z', payload: expect.objectContaining({ qualification: 'qualification:one', version: 1 }) }));
    expect(committed.events[0]).toMatchObject({ type: 'qualification.changed', payload: { qualificationId: 'qualification:one', state: 'published', categoryIds: ['category:food'] } });
  });

  it('fails publication before opening the write transaction when evidence was replaced', async () => {
    const cases = { find: vi.fn(), lock: vi.fn(), save: vi.fn() } as unknown as QualificationCaseRepository;
    const handler = new QualificationsPublishHandler(cases, { inspect: async (reference: string) => ({ reference, sha256: 'b'.repeat(64), size: 128, scan: 'clean', contentType: 'application/pdf', path: 'qualification/license.pdf' }) } as never, { schedule: vi.fn() } as never);
    const input = { path: { qualificationid: 'qualification:one' }, query: {}, body: { title: '食品经营许可证', subject: { kind: 'partner', id: 'partner:one' }, applicability: [{ kind: 'category', id: 'category:food' }], expiresAt: '2099-09-30T00:00:00.000Z', evidence: [{ id: 'evidence:one', kind: 'license', reference: 'object:license-one', sha256: 'a'.repeat(64) }] } } as never;
    await expect(handler.prepare(input, context('qualification.qualifications.publish', 0), null)).rejects.toThrow('VALIDATION_FAILED');
    expect(cases.lock).not.toHaveBeenCalled();
    expect(cases.save).not.toHaveBeenCalled();
  });

  it('revokes the optimistic version and emits the immediate risk event', async () => {
    const published = snapshot({ state: 'published', version: 1, publishedAt: '2026-09-05T00:00:00.000Z' });
    const save = vi.fn(async (_context, value: QualificationCaseSnapshot) => record(value));
    const handler = new QualificationsRevokeHandler({ lock: async () => published, save } as unknown as QualificationCaseRepository);
    const result = await handler.execute(
      { path: { qualificationid: published.id }, query: {}, body: { reason: '证照已被监管机构撤销' } } as never,
      context('qualification.qualifications.revoke', 1)
    );
    expect(save).toHaveBeenCalledWith(transaction, expect.objectContaining({ state: 'revoked', version: 2 }), 1);
    expect(result.events?.[0]).toMatchObject({ type: 'qualification.revoked', payload: { state: 'revoked', subjectId: 'partner:one' } });
  });

  it('uses the scheduled version as an expiry fence and writes one transactional event', async () => {
    const current = snapshot({ state: 'published', version: 1, publishedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-09-04T00:00:00.000Z' });
    const save = vi.fn(async (_context, value: QualificationCaseSnapshot) => record(value));
    const append = vi.fn(async () => undefined);
    const process = new ExpireQualification(
      { write: async (_options: unknown, work: (context: WriteTransactionContext) => Promise<void>) => work(transaction) } as never,
      { lock: async () => current, save } as unknown as QualificationCaseRepository,
      { append } as never
    );
    await process.execute({ qualification: current.id, scope: current.scope, version: 1, trace: 'trace:expiry', signal: new AbortController().signal, deadline: Date.now() + 5_000 });
    expect(save).toHaveBeenCalledWith(transaction, expect.objectContaining({ state: 'expired', version: 2 }), 1);
    expect(append).toHaveBeenCalledWith(transaction, expect.objectContaining({ type: 'qualification.expired', payload: expect.objectContaining({ qualificationId: current.id, state: 'expired' }) }));

    save.mockClear();
    append.mockClear();
    await process.execute({ qualification: current.id, scope: current.scope, version: 0, trace: 'trace:stale', signal: new AbortController().signal, deadline: Date.now() + 5_000 });
    expect(save).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
});

const transaction = { mode: 'write' } as WriteTransactionContext;

function context<TKey extends 'qualification.qualifications.publish' | 'qualification.qualifications.revoke'>(operation: TKey, expectedVersion: number): WriteHandlerContext<TKey> {
  return {
    requestId: 'request:one', traceId: 'trace:one', deadline: Date.now() + 5_000, signal: new AbortController().signal,
    operation, headers: {}, rawBody: '', idempotencyKey: 'qualification:one', expectedVersion, transaction,
    security: { kind: 'session', access: {
      actor: { id: 'principal:reviewer', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['qualification.manage']), denies: new Set() }, scopes: [] },
      roles: [], organization: 'mall:one', scope: { id: 'mall:one', kind: 'mall', path: [] }, accessVersion: 1,
      capabilities: new Set([operation]), capabilityVersion: 1, assurance: { level: 3 }, trace: 'trace:one',
    } },
  } as never;
}

function snapshot(overrides: Partial<QualificationCaseSnapshot> = {}): QualificationCaseSnapshot {
  return {
    id: 'qualification:one', scope: 'mall:one', title: '食品经营许可证', subject: { kind: 'partner', id: 'partner:one' },
    applicability: [{ kind: 'category', id: 'category:food' }], state: 'verified', version: 0,
    effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: '2099-09-30T00:00:00.000Z',
    evidence: [{ id: 'evidence:one', kind: 'license', reference: 'object:license-one', sha256: 'a'.repeat(64), state: 'verified', verifiedAt: '2026-09-04T00:00:00.000Z', verifiedBy: 'principal:reviewer' }],
    reviewedAt: '2026-09-04T00:00:00.000Z', reviewedBy: 'principal:reviewer', publishedAt: null,
    revokedAt: null, revokedBy: null, revokeReason: null, ...overrides,
  };
}

function record(value: QualificationCaseSnapshot): QualificationCaseRecord {
  return {
    id: value.id, title: value.title, subject_kind: value.subject.kind, subject_id: value.subject.id, state: value.state,
    version: value.version, effective_at: value.effectiveAt, expires_at: value.expiresAt, reviewed_at: value.reviewedAt,
    published_at: value.publishedAt, revoked_at: value.revokedAt, revoke_reason: value.revokeReason,
    evidence_count: value.evidence.length, applicability: value.applicability,
  };
}
