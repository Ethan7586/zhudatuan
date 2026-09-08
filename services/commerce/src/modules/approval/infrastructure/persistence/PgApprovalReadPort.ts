import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ApprovalRepository } from '../../application/port/ApprovalRepository';
import type { ApprovalReadPort } from '../../public';

export class PgApprovalReadPort implements ApprovalReadPort {
  constructor(private readonly approvals: ApprovalRepository) {}

  read(context: ReadTransactionContext, scopeId: string, instanceId: string) {
    if (context.scope !== scopeId) throw new DomainError('SCOPE_DENIED');
    return this.approvals.getInstance(context, scopeId, instanceId);
  }
}
