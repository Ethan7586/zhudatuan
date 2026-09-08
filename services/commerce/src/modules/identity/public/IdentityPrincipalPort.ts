import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface IdentityPrincipal {
  ensurePending(context: WriteTransactionContext, principal: string): Promise<void>;
}

export const MEMBER_IMPORT_IDENTITY_PORT = publicPort<IdentityPrincipal>('identity', 'memberimport');
