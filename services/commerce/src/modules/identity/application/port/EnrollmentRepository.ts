import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface EnrollmentRepository {
  findPrincipal(context: ReadTransactionContext, subjectHash: string): Promise<string | null>;
  createPrincipal(context: WriteTransactionContext, principal: string): Promise<void>;
  activatePrincipal(context: WriteTransactionContext, principal: string): Promise<void>;
  createPassword(context: WriteTransactionContext, principal: string, subjectHash: string, secretHash: string): Promise<void>;
}
