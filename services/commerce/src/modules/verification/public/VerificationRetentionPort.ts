import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface VerificationRetentionPort {
  purge(context: WriteTransactionContext): Promise<void>;
}

export const RUNTIME_VERIFICATION_PORT = publicPort<VerificationRetentionPort>('verification', 'runtime');
