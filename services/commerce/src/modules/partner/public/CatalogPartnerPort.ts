import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface CatalogPartnerPort {
  scope(context: ReadTransactionContext, partner: string): Promise<string | null>;
}
export const CATALOG_PARTNER_PORT = publicPort<CatalogPartnerPort>('partner', 'catalog');
