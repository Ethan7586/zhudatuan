import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface MemberCatalogPort {
  published(context: ReadTransactionContext, listing: string, mall: string): Promise<boolean>;
}
export const MEMBER_CATALOG_PORT = publicPort<MemberCatalogPort>('catalog', 'member');
