import { createHash } from 'node:crypto';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ApprovalPort, ApprovalRequestReceipt } from '../../../approval/public';
import type { Withdrawal } from '../../domain/model/Withdrawal';

export class RequestWithdrawalApproval {
  constructor(private readonly approvals: ApprovalPort) {}

  create(context: WriteTransactionContext, withdrawal: Withdrawal, requester: string): Promise<ApprovalRequestReceipt> {
    const evidenceHash = createHash('sha256').update(`${withdrawal.id}\u0000${withdrawal.memberId}\u0000${withdrawal.money.amountMinor}\u0000${withdrawal.money.currency}\u0000${withdrawal.accountRef}`).digest('hex');
    return this.approvals.request(context, {
      scopeId: withdrawal.scopeId,
      requesterId: requester,
      subject: {
        kind: 'withdrawal',
        id: withdrawal.id,
        version: withdrawal.version,
        snapshot: { memberId: withdrawal.memberId, amountMinor: Number(withdrawal.money.amountMinor), currency: withdrawal.money.currency, accountRef: withdrawal.accountRef },
      },
      action: 'referral.withdrawal.pay',
      evidenceHash,
      amountMinor: Number(withdrawal.money.amountMinor),
      currency: withdrawal.money.currency,
      constraints: { scopeId: withdrawal.scopeId, memberId: withdrawal.memberId },
      expiresAt: null,
    });
  }
}
