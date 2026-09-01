import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface IdentityPrincipal {
  ensurePending(context: WriteTransactionContext, principal: string): Promise<void>;
}

export const MEMBER_IMPORT_IDENTITY_PORT = publicPort<IdentityPrincipal>('identity', 'memberimport');
