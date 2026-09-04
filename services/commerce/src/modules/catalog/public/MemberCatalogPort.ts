import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface MemberCatalogVisibility {
  readonly listing: string;
  readonly visible: boolean;
  readonly reason: 'removed' | 'unpublished' | 'outofscope' | 'unavailable' | null;
}

export interface MemberCatalogPort {
  published(context: ReadTransactionContext, listing: string, mall: string): Promise<boolean>;
  visibility(context: ReadTransactionContext, listings: readonly string[], mall: string): Promise<readonly MemberCatalogVisibility[]>;
}
export const MEMBER_CATALOG_PORT = publicPort<MemberCatalogPort>('catalog', 'member');
