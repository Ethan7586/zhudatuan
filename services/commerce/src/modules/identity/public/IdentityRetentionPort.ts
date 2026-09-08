import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface IdentityRetentionPort {
  purge(context: WriteTransactionContext): Promise<void>;
}

export const RUNTIME_IDENTITY_PORT = publicPort<IdentityRetentionPort>('identity', 'runtime');
