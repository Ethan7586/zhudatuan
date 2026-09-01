import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface CatalogPosition {
  readonly sort: string;
  readonly id: string;
}
export interface StorefrontListing {
  readonly id: string;
  readonly sku: string;
  readonly product: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly coverUrl: string | null;
  readonly kind: string;
  readonly categoryId: string;
  readonly categoryCode: string;
  readonly categoryName: string;
  readonly brandId: string | null;
  readonly supplierId: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly specifications: Readonly<Record<string, unknown>>;
  readonly version: string;
  readonly updatedAt: string;
}
export interface CatalogReadPort {
  listings(
    context: ReadTransactionContext,
    input: Readonly<{
      mall: string;
      pool: string;
      limit: number;
      after: CatalogPosition | null;
      product: string | null;
      listings: readonly string[] | null;
      query: string | null;
      category: string | null;
      account: 'welfare' | 'meal' | 'wechat' | 'cash' | null;
      exclusive: boolean;
    }>
  ): Promise<
    Readonly<{
      items: readonly StorefrontListing[];
      next: CatalogPosition | null;
    }>
  >;
}
export const CATALOG_READ_PORT = publicPort<CatalogReadPort>('catalog', 'read');
