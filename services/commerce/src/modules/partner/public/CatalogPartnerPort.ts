import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface CatalogPartnerPort {
  scopes(context: ReadTransactionContext, partners: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
export const CATALOG_PARTNER_PORT = publicPort<CatalogPartnerPort>('partner', 'catalog');
