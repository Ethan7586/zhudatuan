import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface EnrollmentRepository {
  findPrincipal(context: ReadTransactionContext, subjectHash: string): Promise<string | null>;
  createPendingPrincipal(context: WriteTransactionContext, input: Readonly<{ principal: string; createdAt: Date }>): Promise<void>;
  activatePrincipal(context: WriteTransactionContext, principal: string): Promise<void>;
  createPassword(context: WriteTransactionContext, principal: string, subjectHash: string, secretHash: string): Promise<void>;
}
