import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CatalogImportRecord extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly reportObjectRef: string | null;
  readonly reportSha256: string | null;
  readonly reportSize: number | null;
}

export interface CatalogImportRepository {
  create(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; reference: string; sha256: string }>): Promise<Readonly<Record<string, unknown>>>;
  read(context: ReadTransactionContext, id: string, scope: string): Promise<CatalogImportRecord | null>;
}
