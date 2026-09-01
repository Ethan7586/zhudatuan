import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface ExperienceCatalogReferences {
  readonly products: readonly string[];
  readonly categories: readonly string[];
  readonly collections: readonly string[];
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
  references(context: ReadTransactionContext, pool: string, input: ExperienceCatalogReferences): Promise<boolean>;
}
export const EXPERIENCE_CATALOG_PORT = publicPort<ExperienceCatalogPort>('catalog', 'experience');
