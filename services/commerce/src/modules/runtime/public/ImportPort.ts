import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ImportRuntimeChunk, ImportRuntimeCoordinator, ImportStagedChunk, ImportState } from './ImportProcess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface RuntimeImportError {
  readonly row_number: number;
  readonly reason_code: string;
  readonly field: string | null;
  readonly detail: unknown;
}

export interface RuntimeImportReport {
  readonly reference: string;
  readonly sha256: string;
  readonly size: number;
}

export interface RuntimeImportCreated {
  readonly id: string;
  readonly state: ImportState;
  readonly total_count: number;
  readonly cursor_value: number;
  readonly success_count: number;
  readonly failure_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface RuntimeImportView extends RuntimeImportCreated {
  readonly validation_summary: Readonly<Record<string, unknown>>;
  readonly last_error: string | null;
  readonly errors: readonly RuntimeImportError[];
}

export interface RuntimeImportRecord {
  readonly body: RuntimeImportView;
  readonly report: RuntimeImportReport | null;
}

export type RuntimeImportChunk = ImportRuntimeChunk;
export type RuntimeStagedChunk = ImportStagedChunk;

export interface ImportPort extends ImportRuntimeCoordinator {
  create(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; owner: string; kind: string; reference: string; sha256: string; name: string; mediaType: string; size: number; actor: string; authorization: Readonly<Record<string, unknown>>; metadata?: Readonly<Record<string, unknown>> }>): Promise<RuntimeImportCreated>;
  read(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeImportRecord | null>;
}

export const RUNTIME_IMPORT_PORT = publicPort<ImportPort>('runtime', 'import');
