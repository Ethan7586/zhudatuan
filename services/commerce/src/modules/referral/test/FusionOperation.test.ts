import { OPERATION_SCHEMAS, OperationCatalog, type OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { WithdrawalsCreateHandler } from '../application/handler/WithdrawalsCreateHandler';
import type { ReferralRepository } from '../application/port/ReferralRepository';
import type { WithdrawalRepository } from '../application/port/WithdrawalRepository';
import { WithdrawalApprovedSubscriber } from '../interface/event/WithdrawalApprovedSubscriber';
import { RequestWithdrawalApproval } from '../application/service/RequestWithdrawalApproval';
import { MembersApplyHandler } from '../application/handler/MembersApplyHandler';

const operations = Object.freeze([
  'referral.settings.read',
  'referral.settings.manage',
  'referral.products.read',
  'referral.products.manage',
  'referral.members.read',
  'referral.members.apply',
  'referral.members.approve',
  'referral.members.disqualify',
  'referral.bindings.read',
  'referral.bindings.create',
  'referral.commissions.read',
  'referral.earnings.read',
  'referral.links.read',
  'referral.withdrawals.read',
  'referral.withdrawals.create',
] as const satisfies readonly OperationId[]);

describe('Referral fusion operations', () => {
  it('retains all fifteen executable MVP operation contracts', () => {
    expect(operations).toHaveLength(15);
    for (const id of operations) {
      expect(OperationCatalog.get(id)).toMatchObject({ module: 'referral', lifecycle: 'active' });
      expect(OPERATION_SCHEMAS[id].input).toBeDefined();
      expect(OPERATION_SCHEMAS[id].output).toBeDefined();
    }
  });

  it('creates a withdrawal approval before reserving balance and returns its visible state', async () => {
    const request = vi.fn(async () => ({ instanceId: 'approvalinstance:one', state: 'pending' as const, templateId: 'approvaltemplate:one', templateVersion: 1, version: 1, requestedAt: '2026-09-05T08:00:00.000Z' }));
    const create = vi.fn(async (_context, input) => withdrawal(input.approvalId));
    const handler = new WithdrawalsCreateHandler(referrals(), withdrawals(create), { next: () => 'referralwithdrawal:one' }, new RequestWithdrawalApproval({ request, cancel: vi.fn(), consume: vi.fn() }));
    const context = { ...readHandlerContext('referral.withdrawals.create', transaction()), expectedVersion: 4 } as never;
    const reply = await handler.execute({ body: { amountMinor: 5_000, currency: 'CNY', accountRef: 'account:masked', expectedVersion: 4 } } as never, context);
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ subject: expect.objectContaining({ kind: 'withdrawal', id: 'referralwithdrawal:one', version: 1 }), action: 'referral.withdrawal.pay', amountMinor: 5_000, currency: 'CNY' })
    );
    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ approvalId: 'approvalinstance:one', expectedVersion: 4 }));
    expect(OPERATION_SCHEMAS['referral.withdrawals.create'].output.parse(reply.body)).toEqual(reply.body);
  });

  it('accepts only an approval event bound to a referral withdrawal payment', () => {
    const subscriber = new WithdrawalApprovedSubscriber();
    expect(
      subscriber.receive('event:one', 'mall:one', { instanceId: 'approvalinstance:one', subjectKind: 'withdrawal', subjectId: 'referralwithdrawal:one', subjectVersion: 1, action: 'referral.withdrawal.pay', proofId: 'approvalproof:one' })
    ).toEqual({ eventId: 'event:one', eventType: 'approval.instance.approved', scopeId: 'mall:one', sourceId: 'approvalinstance:one', resourceId: 'referralwithdrawal:one' });
    expect(() => subscriber.receive('event:two', 'mall:one', { instanceId: 'approvalinstance:two', subjectKind: 'refund', subjectId: 'refund:one', action: 'refund.pay' })).toThrow('REFERRAL_APPROVAL_SUBJECT_INVALID');
  });

  it('honors recruitment and automatic-review settings without creating a second approval path', async () => {
    const applyMember = vi.fn(async (_context, input) => ({ id: input.id, memberId: input.memberId, status: input.state }));
    const source = referrals();
    source.setting = vi.fn(async () => ({ enabled: true, recruitEnabled: true, reviewRequired: false }));
    source.applyMember = applyMember;
    const handler = new MembersApplyHandler(source, { next: () => 'referralmember:auto' });
    const reply = await handler.execute({ body: { displayName: '自动推广员', mobile: '13800000000', reason: '符合自动招募策略' } } as never, readHandlerContext('referral.members.apply', transaction()) as never);
    expect(applyMember).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ state: 'active', memberId: 'referralmember:one' }));
    expect(reply.status).toBe(201);
  });
});

function referrals(): ReferralRepository {
  return {
    eligible: async () => ({ memberId: 'referralmember:one', scopeId: 'mall:one', version: 1 }),
    setting: vi.fn(),
    manageSetting: vi.fn(),
    products: vi.fn(),
    manageProduct: vi.fn(),
    members: vi.fn(),
    member: vi.fn(),
    applyMember: vi.fn(),
    decideMember: vi.fn(),
    bindings: vi.fn(),
    binding: vi.fn(),
    attribution: vi.fn(),
    bind: vi.fn(),
    link: vi.fn(),
  };
}

function withdrawals(create: WithdrawalRepository['create']): WithdrawalRepository {
  return {
    read: vi.fn(),
    position: async () => ({ availableMinor: 10_000, hasPendingReversal: false, minimumMinor: 1_000, monthlyUsed: 0, monthlyLimit: 3, currency: 'CNY', version: 4 }),
    create,
  };
}

function withdrawal(approvalId: string) {
  return {
    id: 'referralwithdrawal:one',
    memberId: 'referralmember:one',
    status: 'requested',
    amountMinor: 5_000,
    currency: 'CNY',
    accountRef: 'account:masked',
    approvalId,
    requestedAt: '2026-09-05T08:00:00.000Z',
    approvedAt: null,
    completedAt: null,
    providerReference: null,
    failureReason: null,
    version: 1,
  };
}

function transaction(): WriteTransactionContext {
  return { scope: 'mall:one', membership: 'membership:test', mode: 'write' } as unknown as WriteTransactionContext;
}
