import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface AccessPartnerScope {
  readonly id: string;
  readonly kind: 'supplier' | 'brand' | 'store';
  readonly organization: string;
}
export interface AccessPartnerPort {
  invitationScope(context: ReadTransactionContext, partner: string): Promise<AccessPartnerScope | null>;
}
export const ACCESS_PARTNER_PORT = publicPort<AccessPartnerPort>('partner', 'access');
