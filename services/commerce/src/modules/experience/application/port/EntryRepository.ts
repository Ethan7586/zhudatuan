import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface StorefrontEntry {
  readonly application: string;
  readonly handle: string;
  readonly url: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly tenant: string;
  readonly contentHash: string;
  readonly objectKey: string;
}

export interface EntryRepository {
  resolve(context: ReadTransactionContext, handle: string): Promise<StorefrontEntry>;
}
