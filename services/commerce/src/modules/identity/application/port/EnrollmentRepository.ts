import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface EnrollmentRepository {
  findPrincipal(database: OperationDatabase, subjectHash: string): Promise<string | null>;
  createPrincipal(database: OperationDatabase, principal: string): Promise<void>;
  activatePrincipal(database: OperationDatabase, principal: string): Promise<void>;
  createPassword(database: OperationDatabase, principal: string, subjectHash: string, secretHash: string): Promise<void>;
}
