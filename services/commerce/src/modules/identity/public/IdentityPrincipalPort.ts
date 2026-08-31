import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface IdentityPrincipal {
  ensurePending(database: OperationDatabase, principal: string): Promise<void>;
}
