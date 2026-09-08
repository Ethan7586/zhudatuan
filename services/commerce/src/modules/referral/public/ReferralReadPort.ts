import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface ReferralReadPort {
  binding(context: ReadTransactionContext, scopeId: string, customerId: string): Promise<Readonly<{ promoterId: string; source: string; expiresAt: string | null; version: number }> | null>;
}

export const REFERRAL_READ_PORT = publicPort<ReferralReadPort>('referral', 'read');
