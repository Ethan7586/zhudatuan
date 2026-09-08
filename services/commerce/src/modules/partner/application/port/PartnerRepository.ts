import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface PartnerRepository {
  partners(
    context: ReadTransactionContext,
    input: Readonly<{ scopes: readonly string[]; own: string; kind: 'supplier' | 'brand' | 'store' | null; sort: string | null; id: string | null; fetch: number }>
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
  savePartner(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; kind: 'supplier' | 'brand'; name: string; status: 'pending' | 'active' | 'suspended' | 'terminated'; expectedVersion: number | null }>
  ): Promise<Readonly<Record<string, unknown>> | null>;
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
      addressChanged: boolean;
      ciphertext: string | null | undefined;
      token: string | null | undefined;
      keyVersion: string | null | undefined;
      expectedVersion: number | null;
    }>
  ): Promise<Readonly<Record<string, unknown>> | null>;
}
