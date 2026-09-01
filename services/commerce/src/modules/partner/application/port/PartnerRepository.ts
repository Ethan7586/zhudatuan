import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface PartnerRepository {
  partners(context: ReadTransactionContext, input: Readonly<{ scopes: readonly string[]; own: string; sort: string | null; id: string | null; fetch: number }>): Promise<readonly Readonly<Record<string, unknown>>[]>;
  savePartner(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; kind: string; name: string; status: 'active' | 'suspended'; expectedVersion: number | null }>): Promise<Readonly<Record<string, unknown>> | null>;
  stores(context: ReadTransactionContext, input: Readonly<{ scopes: readonly string[]; sort: string | null; id: string | null; fetch: number }>): Promise<readonly Readonly<Record<string, unknown>>[]>;
  storeScope(context: WriteTransactionContext, id: string, scopes: readonly string[]): Promise<string | null>;
  saveStore(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      scopes: readonly string[];
      name: string;
      status: string;
      mall: string | null;
      region: string;
      radius: number | null;
      ciphertext: string | null;
      token: string | null;
      keyVersion: string | null;
      expectedVersion: number | null;
    }>
  ): Promise<Readonly<Record<string, unknown>> | null>;
}
