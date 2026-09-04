import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogPage } from '../model/CatalogPage';

export interface PoolRepository {
  read(context: ReadTransactionContext, scope: string, page: CatalogPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  attach(context: WriteTransactionContext, accessScope: string, mall: string, pool: string, expectedVersion: number): Promise<Readonly<Record<string, unknown>>>;
  detach(context: WriteTransactionContext, accessScope: string, mall: string, pool: string, expectedVersion: number): Promise<Readonly<Record<string, unknown>>>;
  allocate(context: WriteTransactionContext, input: Readonly<{ accessScope: string; platform: boolean; source: string; scope: string; kind: 'markup' | 'channel'; name: string }>): Promise<Readonly<Record<string, unknown>>>;
}
