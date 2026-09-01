import type { ContractJsonValue } from '@shop/contract';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface InventoryImportRecord {
  readonly id: string;
  readonly state: string;
  readonly total_count: number;
  readonly cursor_value: number;
  readonly success_count: number;
  readonly failure_count: number;
  readonly validation_summary: ContractJsonValue;
  readonly last_error: string | null;
  readonly report_object_ref: string | null;
  readonly report_sha256: string | null;
  readonly report_size: number | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly errors: readonly Readonly<{ row_number: number; reason_code: string; field: string | null; detail: ContractJsonValue }>[];
}

export interface InventoryImportRepository {
  create(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; reference: string; sha256: string }>): Promise<InventoryImportRecord>;
  read(context: ReadTransactionContext, id: string, scope: string): Promise<InventoryImportRecord | null>;
}
