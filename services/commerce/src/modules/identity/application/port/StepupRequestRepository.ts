import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

import type { ActionProofBinding, AuthorizedActionProof } from '../../../access/public';

export interface StepupRequestRepository {
  save(context: WriteTransactionContext, challenge: string, approval: AuthorizedActionProof): Promise<void>;
  consume(context: WriteTransactionContext, challenge: string, checkerMembership: string): Promise<ActionProofBinding | null>;
}
