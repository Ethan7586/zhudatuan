import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import type { TransactionManager } from '../../../platform/database/TransactionManager';
import type { StoredObject } from './ObjectPort';

export type ImportOwner = 'catalog' | 'finance' | 'inventory' | 'member' | 'order' | 'voucher';
export type ImportState = 'uploaded' | 'validating' | 'ready' | 'running' | 'reporting' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface ImportFailure {
  readonly row: number;
  readonly reason: string;
  readonly field: string | null;
  readonly detail: string;
}

export interface ImportTarget {
  readonly id: string;
  readonly scope: string;
  readonly reference: string;
  readonly sha256: string;
  readonly state: ImportState;
  readonly authorization: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly confirmed: boolean;
}

export interface ImportExecution {
  readonly scope: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface BatchImportProcessPort {
  find(id: string, execution: ImportExecution): Promise<ImportTarget | null>;
  authorize(target: ImportTarget, execution: ImportExecution): Promise<void>;
  stage(target: ImportTarget, rows: Iterable<Readonly<Record<string, string>>> | AsyncIterable<Readonly<Record<string, string>>>, execution: ImportExecution): Promise<void>;
  process(target: ImportTarget, signal: AbortSignal, deadline: number): Promise<boolean>;
  failures(target: ImportTarget, execution: ImportExecution): Promise<readonly ImportFailure[]>;
  report(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void>;
  complete(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void>;
  reject(target: ImportTarget, code: string, detail: string, execution: ImportExecution): Promise<void>;
  fault(target: ImportTarget, detail: string, execution: ImportExecution): Promise<void>;
}

export interface ImportStagedChunk {
  readonly sequence: number;
  readonly rows: readonly Readonly<{ row: number; payload: Readonly<Record<string, string>> }>[];
}

export interface ImportCandidate {
  readonly row: number;
  readonly value: Readonly<Record<string, string>>;
}

export interface ImportPreparedBatch {
  readonly rows: readonly Readonly<{ row: number; payload: Readonly<Record<string, string>> }>[];
  readonly failures: readonly ImportFailure[];
}

export interface ImportRuntimeChunk extends ImportStagedChunk {
  readonly token: number;
}
export interface ImportStageCursor {
  readonly sequence: number;
  readonly staged: number;
  readonly size?: number;
}
export interface ImportProgress {
  readonly total: number;
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
}

export interface ImportRuntimeCoordinator {
  find(context: ReadTransactionContext, id: string, owner: string): Promise<ImportTarget | null>;
  begin(context: WriteTransactionContext, id: string, owner: string): Promise<ImportStageCursor>;
  stage(context: WriteTransactionContext, id: string, owner: string, chunks: readonly ImportStagedChunk[], failures?: readonly ImportFailure[]): Promise<void>;
  ready(context: WriteTransactionContext, id: string, owner: string, total: number, columns: readonly string[]): Promise<void>;
  claim(context: WriteTransactionContext, id: string, owner: string, leaseSeconds: number): Promise<ImportRuntimeChunk | null>;
  assertLease(context: WriteTransactionContext, id: string, owner: string, chunk: number, token: number): Promise<void>;
  finish(context: WriteTransactionContext, id: string, owner: string, chunk: number, token: number, succeeded: number, failures: readonly ImportFailure[]): Promise<boolean>;
  abandon(context: WriteTransactionContext, id: string, owner: string, chunk: number, token: number, detail: string): Promise<void>;
  failures(context: ReadTransactionContext, id: string, owner: string): Promise<readonly ImportFailure[]>;
  progress(context: ReadTransactionContext, id: string, owner: string): Promise<ImportProgress | null>;
  report(context: WriteTransactionContext, id: string, owner: string, report: Readonly<{ reference: string; sha256: string; size: number }>): Promise<void>;
  complete(context: WriteTransactionContext, id: string, owner: string, report: Readonly<{ reference: string; sha256: string; size: number }>): Promise<void>;
  reject(context: WriteTransactionContext, id: string, owner: string, code: string, detail: string): Promise<void>;
  fault(context: WriteTransactionContext, id: string, owner: string, detail: string): Promise<void>;
}

export interface ImportAuthorizationPort {
  assert(context: ReadTransactionContext, evidence: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface ImportBatchConfiguration {
  readonly owner: ImportOwner;
  readonly failure: string;
  readonly transactions: TransactionManager;
  readonly runtime: ImportRuntimeCoordinator;
  readonly authorization: ImportAuthorizationPort;
  readonly prepare?: (target: ImportTarget, rows: readonly ImportCandidate[], execution: ImportExecution) => Promise<ImportPreparedBatch>;
  readonly write: (context: WriteTransactionContext, target: ImportTarget, row: number, value: Readonly<Record<string, string>>) => Promise<void>;
  readonly continue: (context: WriteTransactionContext, target: ImportTarget, sequence: number) => Promise<void>;
  readonly publish?: (target: ImportTarget, report: StoredObject, execution: ImportExecution) => Promise<void>;
  readonly concurrency?: number;
}

export interface ImportBatchFactoryPort {
  create(configuration: ImportBatchConfiguration): BatchImportProcessPort;
}

export interface ImportRunnerPort {
  execute(owner: ImportOwner, process: BatchImportProcessPort, id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void>;
}

export const IMPORT_BATCH_FACTORY_PORT = publicPort<ImportBatchFactoryPort>('runtime', 'importbatchfactory');
export const IMPORT_RUNNER_PORT = publicPort<ImportRunnerPort>('runtime', 'importrunner');
