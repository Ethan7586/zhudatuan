import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface CatalogPartnerPort {
  scopes(context: ReadTransactionContext, partners: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
export const CATALOG_PARTNER_PORT = publicPort<CatalogPartnerPort>('partner', 'catalog');
