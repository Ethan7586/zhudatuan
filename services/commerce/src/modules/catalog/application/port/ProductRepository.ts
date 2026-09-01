import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ProductRepository {
  detail(context: ReadTransactionContext, product: string, scope: string, store: boolean): Promise<Readonly<Record<string, unknown>>>;
  create(
    context: WriteTransactionContext,
    input: Readonly<{ scope: string; owner: string | null; brand: string | null; category: string; title: string; kind: string; attributes: Readonly<Record<string, unknown>> }>
  ): Promise<Readonly<Record<string, unknown>>>;
  update(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; title: string | null; category: string | null; attributes: Readonly<Record<string, unknown>> | null; status: string | null; expectedVersion: number | null }>
  ): Promise<Readonly<Record<string, unknown>>>;
  archive(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number | null): Promise<Readonly<Record<string, unknown>>>;
}
