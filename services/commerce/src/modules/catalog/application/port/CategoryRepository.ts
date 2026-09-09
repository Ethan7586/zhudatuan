import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogPage } from '../model/CatalogPage';
import type { CategorySnapshot } from '../../domain/model/Category';

export interface CategoryRecord {
  readonly id: string;
  readonly parent_id: string | null;
  readonly parent_name: string | null;
  readonly code: string;
  readonly name: string;
  readonly status: CategorySnapshot['state'];
  readonly sort_order: number;
  readonly product_count: number;
}

export interface CategoryRepository {
  read(context: ReadTransactionContext, query: string, page: CatalogPage): Promise<readonly CategoryRecord[]>;
  create(context: WriteTransactionContext, input: Readonly<{ name: string; parent: string | null; sort: number }>): Promise<CategoryRecord>;
}
