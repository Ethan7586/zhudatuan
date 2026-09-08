import { createHash } from 'node:crypto';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ApprovalPort, ApprovalReadPort, ApprovalRequest } from '../../../approval/public';

export class VoucherApproval {
  constructor(
    private readonly approval: ApprovalPort,
    private readonly read: ApprovalReadPort
  ) {}

  request(context: WriteTransactionContext, input: Pick<ApprovalRequest, 'subject' | 'action' | 'constraints' | 'expiresAt' | 'amountMinor' | 'currency'>) {
    return this.approval.request(context, { ...input, scopeId: context.scope, requesterId: context.membership, evidenceHash: createHash('sha256').update(JSON.stringify(input.subject.snapshot)).digest('hex') });
  }

  async cancel(context: WriteTransactionContext, input: Readonly<{ scope: string; instance: string; reason: string }>): Promise<void> {
    const current = await this.read.read(context, input.scope, input.instance);
    if (!current || current.state !== 'pending') throw new DomainError('VOUCHER_STATE_INVALID');
    // Approval owns the locked state/version check. A decision racing this read must
    // make the shared transaction fail, never leave a decided request cancelled.
    await this.approval.cancel(context, { scopeId: input.scope, instanceId: current.id, requesterId: context.membership, expectedVersion: current.version, reason: input.reason });
  }
}
