import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export type CatalogDimensionKind = 'product' | 'category';

export interface CatalogDimensionLabel {
  readonly kind: CatalogDimensionKind;
  readonly id: string;
  readonly name: string;
}

export interface CatalogDimensionPort {
  labels(context: ReadTransactionContext, input: Readonly<{ products: readonly string[]; categories: readonly string[] }>): Promise<readonly CatalogDimensionLabel[]>;
}

export const CATALOG_DIMENSION_PORT = publicPort<CatalogDimensionPort>('catalog', 'dimension');
