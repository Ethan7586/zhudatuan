import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface IdentityRetentionPort {
  purge(context: WriteTransactionContext): Promise<void>;
}

export const RUNTIME_IDENTITY_PORT = publicPort<IdentityRetentionPort>('identity', 'runtime');
