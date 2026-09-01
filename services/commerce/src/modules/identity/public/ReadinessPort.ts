import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface IdentityReadinessPort {
  invitationKeysReady(context: ReadTransactionContext, versions: readonly string[]): Promise<boolean>;
}

export const IDENTITY_READINESS_PORT = publicPort<IdentityReadinessPort>('identity', 'readiness');
