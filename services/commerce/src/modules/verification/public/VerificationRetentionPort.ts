import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface VerificationRetentionPort {
  purge(context: WriteTransactionContext): Promise<void>;
}

export const RUNTIME_VERIFICATION_PORT = publicPort<VerificationRetentionPort>('verification', 'runtime');
