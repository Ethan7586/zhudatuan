import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface ExperienceCatalogReferences {
  readonly products: readonly string[];
  readonly categories: readonly string[];
  readonly collections: readonly string[];
  readonly listings: readonly string[];
}
export interface ExperienceCatalogItem {
  readonly listing: string;
  readonly product: string;
  readonly category: string;
  readonly partner: string | null;
  readonly regions: readonly string[];
  readonly sku: string;
  readonly version: string;
}
export interface ExperienceCatalogEvidence {
  readonly ready: boolean;
  readonly version: string;
  readonly items: readonly ExperienceCatalogItem[];
}
export interface ExperienceCatalogPort {
  provisionPool(context: WriteTransactionContext, input: Readonly<{ mall: string; name: string; source?: string }>): Promise<string>;
  activeBinding(
    context: ReadTransactionContext,
    malls: readonly string[]
  ): Promise<Readonly<{
    mall: string;
    pool: string;
  }> | null>;
  references(context: ReadTransactionContext, pool: string, input: ExperienceCatalogReferences): Promise<ExperienceCatalogEvidence>;
}
export const EXPERIENCE_CATALOG_PORT = publicPort<ExperienceCatalogPort>('catalog', 'experience');
