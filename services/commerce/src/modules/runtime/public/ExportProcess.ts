import { publicPort } from '../../../composition/ModuleRegistry';
import type { ClaimedJob } from './JobProcess';
import type { StoredObject } from './ObjectPort';

export interface ExportExecution {
  readonly scope: string;
  readonly trace: string;
  readonly attempts: number;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface ExportPlan {
  readonly id: string;
  readonly owner: string;
  readonly columns: readonly string[];
  readonly cursor: string | null;
  readonly pageRows: number;
  readonly expectedRows: number | null;
  readonly maximumAttempts: number;
}

export interface ExportPageRow {
  readonly cursor: string;
  readonly cells: readonly unknown[];
}

export interface ExportResult {
  readonly object: StoredObject;
  readonly rows: number;
}

export interface ExportRenderer<TPlan extends ExportPlan = ExportPlan> {
  open(id: string, execution: ExportExecution): Promise<TPlan | null>;
  prepare(plan: TPlan): Promise<number | null>;
  read(plan: TPlan, cursor: string | null, fetch: number): Promise<readonly ExportPageRow[]>;
  advance(plan: TPlan, cursor: string, count: number): Promise<void>;
  complete(plan: TPlan, result: ExportResult): Promise<void>;
  fail(plan: TPlan, code: string, terminal: boolean): Promise<void>;
  retryable(cause: unknown): boolean;
}

export interface ExportRunnerPort {
  executeExport<TPlan extends ExportPlan>(kind: string, id: string, job: ClaimedJob, signal: AbortSignal, deadline: number, renderer: ExportRenderer<TPlan>): Promise<void>;
}

export const EXPORT_RUNNER_PORT = publicPort<ExportRunnerPort>('runtime', 'exportrunner');
