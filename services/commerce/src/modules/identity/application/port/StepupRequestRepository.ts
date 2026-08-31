import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ActionProofBinding, AuthorizedActionProof } from '../../../access/public';

export interface StepupRequestRepository {
  save(database: OperationDatabase, challenge: string, approval: AuthorizedActionProof): Promise<void>;
  consume(database: OperationDatabase, challenge: string, checkerMembership: string): Promise<ActionProofBinding | null>;
}
