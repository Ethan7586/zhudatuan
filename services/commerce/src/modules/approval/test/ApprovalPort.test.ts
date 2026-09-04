import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { TransactionalEventWriter } from '../../../foundation/application/OperationExecutor';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { ApprovalRepository } from '../application/port/ApprovalRepository';
import { PgApprovalPort } from '../infrastructure/persistence/PgApprovalPort';

const context = {
  tenant: 'tenant:one',
  scope: 'scope:one',
  membership: 'membership:maker',
  actor: 'principal:maker',
  trace: 'trace:approval',
} as WriteTransactionContext;

describe('Approval public port', () => {
  it('binds object, action, version, amount, expiry and evidence while emitting assignment facts', async () => {
    const createInstance = vi.fn(async (_context, command) => ({
      instance: {
        ...command,
        templateId: 'approvaltemplate:one',
        templateVersion: 3,
        state: 'pending' as const,
        currentStep: 1,
        stepCount: 1,
        version: 1,
        createdAt: '2026-09-04T08:00:00.000Z',
        decidedAt: null,
        tasks: [],
        decisions: [],
      },
      assigned: [
        {
          id: 'approvaltask:one',
          instanceId: command.id,
          sequence: 1,
          name: '财务复核',
          assigneeKind: 'permission' as const,
          assignee: 'approval.task.decide',
          state: 'pending' as const,
          dueAt: null,
          decidedBy: null,
          decidedAt: null,
          reason: null,
          minimumApprovals: 1,
          approvalCount: 0,
          version: 1,
        },
      ],
    }));
    const append = vi.fn(async () => undefined);
    const port = new PgApprovalPort({ createInstance } as unknown as ApprovalRepository, { append } as TransactionalEventWriter);
    const receipt = await port.request(context, {
      scopeId: context.scope,
      requesterId: context.membership,
      subject: { kind: 'withdrawal', id: 'withdrawal:one', version: 4, snapshot: { account: 'account:one' } },
      action: 'finance.withdrawal.pay',
      evidenceHash: 'a'.repeat(64),
      amountMinor: 50_000,
      currency: 'CNY',
      constraints: { payeeHash: 'b'.repeat(64) },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(receipt).toMatchObject({ templateVersion: 3, state: 'pending' });
    expect(createInstance).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ subjectVersion: 4, action: 'finance.withdrawal.pay', amountMinor: 50_000, currency: 'CNY', evidenceHash: 'a'.repeat(64) })
    );
    expect(append).toHaveBeenCalledTimes(2);
  });

  it('consumes an exact one-use binding and never exposes the persisted token hash', async () => {
    const token = 'a'.repeat(43);
    const consumeProof = vi.fn(async (_context, command) => ({
      id: 'approvalproof:one',
      instanceId: 'approvalinstance:one',
      scopeId: command.scopeId,
      checkerId: 'membership:checker',
      subjectKind: command.subjectKind,
      subjectId: command.subjectId,
      subjectVersion: command.subjectVersion,
      action: command.action,
      evidenceHash: command.evidenceHash,
      amountMinor: command.amountMinor,
      currency: command.currency,
      constraints: command.constraints,
      issuedAt: '2026-09-04T08:00:00.000Z',
      expiresAt: '2026-09-04T08:15:00.000Z',
    }));
    const port = new PgApprovalPort({ consumeProof } as unknown as ApprovalRepository, { append: vi.fn() } as TransactionalEventWriter);
    const binding = {
      scopeId: context.scope,
      subjectKind: 'financerepair' as const,
      subjectId: 'financerepair:one',
      subjectVersion: 8,
      action: 'finance.repair.apply',
      evidenceHash: 'c'.repeat(64),
      amountMinor: 1_200,
      currency: 'CNY',
      constraints: { journalHash: 'd'.repeat(64) },
      consumerOperation: 'finance.reconciliationrepairs.apply',
      requestHash: 'e'.repeat(64),
    };
    const proof = await port.consume(context, token, binding);

    expect(proof.binding).toEqual(binding);
    expect(consumeProof).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ tokenHash: createHash('sha256').update(token).digest(), amountMinor: 1_200, currency: 'CNY' })
    );
    expect(JSON.stringify(proof)).not.toContain(createHash('sha256').update(token).digest('hex'));
  });

  it('rejects partial money bindings and cross-scope callers before persistence', async () => {
    const repository = { createInstance: vi.fn(), consumeProof: vi.fn() } as unknown as ApprovalRepository;
    const port = new PgApprovalPort(repository, { append: vi.fn() } as TransactionalEventWriter);
    await expect(
      port.request(context, {
        scopeId: context.scope,
        requesterId: context.membership,
        subject: { kind: 'refund', id: 'refund:one', version: 1, snapshot: {} },
        action: 'payment.refund.execute',
        evidenceHash: 'a'.repeat(64),
        amountMinor: 1,
        constraints: {},
        expiresAt: null,
      })
    ).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(
      port.consume(context, 'a'.repeat(43), {
        scopeId: 'scope:other',
        subjectKind: 'refund',
        subjectId: 'refund:one',
        subjectVersion: 1,
        action: 'payment.refund.execute',
        evidenceHash: 'a'.repeat(64),
        amountMinor: null,
        currency: null,
        constraints: {},
        consumerOperation: 'payment.refunds.create',
        requestHash: 'b'.repeat(64),
      })
    ).rejects.toThrow(/SCOPE_DENIED/);
  });
});
