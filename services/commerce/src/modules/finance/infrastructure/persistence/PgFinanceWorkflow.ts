import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

export type FinanceWorkflowFactory = (database: SqlExecutor) => PgFinanceWorkflow;

/** Process adapter for finance-owned Runtime jobs and domain events. */
export class PgFinanceWorkflow {
  constructor(private readonly database: SqlExecutor) {}

  async enqueue(kind: 'reconciliation' | 'settlement' | 'invoice', scope: string, payload: unknown, id: string, replay = false, priority = 20): Promise<void> {
    const job = { id, kind, owner: 'finance', scope, payload: record(payload), priority } as const;
    const runtime = new PgRuntimeWriter(this.database);
    if (replay) await runtime.retryFailed(job);
    else await runtime.schedule(job);
  }

  async event(type: string, aggregateType: string, aggregate: string, scope: string, payload: unknown, stableId?: string): Promise<void> {
    const id = stableId ?? `event:${randomUUID()}`;
    await new PgRuntimeWriter(this.database).append({ id, type, aggregateType, aggregate, scope, payload: record(payload), trace: id });
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('FINANCE_RUNTIME_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
