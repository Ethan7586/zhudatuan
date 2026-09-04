import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Withdrawal } from '../../domain/model/Withdrawal';
import { WithdrawalPolicy } from '../../domain/policy/WithdrawalPolicy';
import { ReferralMoney } from '../../domain/value/ReferralMoney';
import type { Identifier } from '../port/Identifier';
import type { ReferralRepository } from '../port/ReferralRepository';
import type { WithdrawalRepository } from '../port/WithdrawalRepository';
import type { RequestWithdrawalApproval } from '../service/RequestWithdrawalApproval';

export class WithdrawalsCreateHandler implements OperationHandler<'referral.withdrawals.create', 'write'> {
  readonly operation = 'referral.withdrawals.create' as const;
  readonly mode = 'write' as const;
  private readonly policy = new WithdrawalPolicy();
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly withdrawals: WithdrawalRepository,
    private readonly identifiers: Identifier,
    private readonly approval: RequestWithdrawalApproval
  ) {}
  async execute(input: OperationInputFor<'referral.withdrawals.create'>, context: WriteHandlerContext<'referral.withdrawals.create'>): Promise<OperationReply<OperationOutputFor<'referral.withdrawals.create'>>> {
    const access = requireSession(context.security);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const body = bodyRecord(input);
    const amount = integerField(body, 'amountMinor', 1);
    const currency = textField(body, 'currency', 3);
    const position = await this.withdrawals.position(context.transaction, member.scopeId, member.memberId);
    if (!position?.currency || Number(position.version) !== context.expectedVersion) throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
    const money = new ReferralMoney(BigInt(amount), currency);
    this.policy.assertRequest(
      money,
      new ReferralMoney(BigInt(position.availableMinor), position.currency),
      BigInt(position.minimumMinor),
      position.hasPendingReversal,
      Number(position.monthlyUsed),
      position.monthlyLimit === null ? null : Number(position.monthlyLimit)
    );
    const model = new Withdrawal(this.identifiers.next('referralwithdrawal'), member.scopeId, member.memberId, money.amountMinor, money.currency, textField(body, 'accountRef'), 'requested', 1);
    const approval = await this.approval.create(context.transaction, model, access.membership.id);
    const result = await this.withdrawals.create(context.transaction, {
      id: model.id,
      scopeId: model.scopeId,
      memberId: model.memberId,
      amountMinor: Number(model.money.amountMinor),
      currency: model.money.currency,
      accountRef: model.accountRef,
      approvalId: approval.instanceId,
      expectedVersion: Number(position.version),
    });
    return { status: 201, body: result as OperationOutputFor<'referral.withdrawals.create'> };
  }
}
