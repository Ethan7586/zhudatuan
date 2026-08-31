import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface IdentityRetentionPort {
  purge(database: OperationDatabase): Promise<void>;
}
