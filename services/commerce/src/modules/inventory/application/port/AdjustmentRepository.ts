import type { ApprovalPort } from '../../../approval/public';
import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface AdjustmentRepository {
  create(
    context: WriteTransactionContext,
    input: Readonly<{
      scope: string;
      requester: string;
      stockitem: string;
      quantityDelta: number;
      reason: string;
      expectedVersion: number;
      idempotency: string;
      approvals: ApprovalPort;
    }>
  ): Promise<Readonly<Record<string, unknown>>>;
  read(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
