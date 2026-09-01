import type { StoredObject } from '../infrastructure/ObjectStore';

export type ImportState = 'uploaded' | 'validating' | 'ready' | 'running' | 'reporting' | 'completed' | 'failed' | 'cancelled';

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
}

export interface ImportExecution {
  readonly scope: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface BatchImportProcessPort {
  find(id: string, execution: ImportExecution): Promise<ImportTarget | null>;
  stage(target: ImportTarget, rows: readonly Readonly<Record<string, string>>[], execution: ImportExecution): Promise<void>;
  process(target: ImportTarget, signal: AbortSignal, deadline: number): Promise<boolean>;
  failures(target: ImportTarget, execution: ImportExecution): Promise<readonly ImportFailure[]>;
  complete(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void>;
  reject(target: ImportTarget, code: string, detail: string, execution: ImportExecution): Promise<void>;
  fault(target: ImportTarget, detail: string, execution: ImportExecution): Promise<void>;
}

export function importId(payload: unknown, code: string): string {
  const value = payload !== null && typeof payload === 'object' ? Reflect.get(payload, 'import') : null;
  if (typeof value !== 'string' || !/^[a-z]+import:[a-f0-9-]{36}$/.test(value)) throw new Error(code);
  return value;
}
