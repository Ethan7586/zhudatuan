import { createHash } from 'node:crypto';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';
import { csvCell } from '../../../../foundation/application/Csv';
import type { ClaimedJob } from '../../public/JobProcess';
import type { ExportExecution, ExportPlan, ExportRenderer } from '../../public/ExportProcess';
import type { ObjectStore, ObjectUpload, StoredObject } from '../../public/ObjectPort';

export class RunExport {
  constructor(private readonly kind: string, private readonly objects: ObjectStore) {
    if (!/^[a-z][a-z0-9]+$/.test(kind)) throw new Error('EXPORT_KIND_INVALID');
  }

  async execute<TPlan extends ExportPlan>(id: string, job: ClaimedJob, signal: AbortSignal, deadline: number, renderer: ExportRenderer<TPlan>): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    if (!id || !job.scope || !Number.isSafeInteger(job.attempts) || job.attempts < 1 || !Number.isFinite(deadline) || deadline <= Date.now()) {
      throw new Error('EXPORT_EXECUTION_INVALID');
    }
    const execution = Object.freeze({ scope: job.scope, trace: job.id, attempts: job.attempts, signal, deadline }) satisfies ExportExecution;
    const plan = await renderer.open(id, execution);
    if (plan === null) return;
    let upload: ObjectUpload | undefined;
    let stored: StoredObject | undefined;
    try {
      validate(plan, id);
      const expectedRows = await renderer.prepare(plan);
      if (expectedRows !== null && (!Number.isSafeInteger(expectedRows) || expectedRows < 0)) throw new Error('EXPORT_EXPECTED_ROWS_INVALID');
      available(execution);
      upload = await this.objects.create(path(execution.scope, plan.owner, plan.id), 'text/csv');
      await upload.append(encode(`\uFEFF${plan.columns.map(csvCell).join(',')}\r\n`));
      let cursor = plan.cursor;
      let rows = 0;
      const seen = new Set<string>();
      for (;;) {
        available(execution);
        const page = await renderer.read(plan, cursor, plan.pageRows);
        if (page.length === 0) break;
        if (page.length > plan.pageRows) throw new Error('EXPORT_PAGE_LIMIT_EXCEEDED');
        for (const row of page) {
          if (!row.cursor || row.cursor === cursor || seen.has(row.cursor) || row.cells.length !== plan.columns.length) throw new Error('EXPORT_PAGE_INVALID');
          seen.add(row.cursor);
        }
        await upload.append(encode(`${page.map((row) => row.cells.map(csvCell).join(',')).join('\r\n')}\r\n`));
        cursor = page.at(-1)!.cursor;
        rows += page.length;
        await renderer.advance(plan, cursor, page.length);
      }
      if (expectedRows !== null && rows !== expectedRows) throw new Error('EXPORT_ROW_COUNT_MISMATCH');
      stored = await upload.complete();
      const inspected = await this.objects.inspect(stored.reference);
      if (inspected.scan !== 'clean' || inspected.sha256 !== stored.sha256 || inspected.size !== stored.size ||
        inspected.contentType !== 'text/csv' || inspected.path !== path(execution.scope, plan.owner, plan.id)) {
        throw new Error('EXPORT_SCAN_OR_INTEGRITY_FAILED');
      }
      await renderer.complete(plan, Object.freeze({ object: stored, rows }));
    } catch (cause) {
      if (stored) await this.objects.remove(stored.reference).catch(() => undefined);
      else await upload?.abort().catch(() => undefined);
      await renderer.fail(plan, safeErrorCode(cause, 'EXPORT_FAILED'), execution.attempts >= plan.maximumAttempts || !renderer.retryable(cause));
      throw cause;
    }
  }
}

function validate(plan: ExportPlan, id: string): void {
  if (plan.id !== id || !/^[a-z][a-z0-9]+$/.test(plan.owner) || plan.columns.length === 0 || new Set(plan.columns).size !== plan.columns.length ||
    plan.columns.some((column) => !column || column.length > 100) || !Number.isSafeInteger(plan.pageRows) || plan.pageRows < 1 || plan.pageRows > 10_000 ||
    (plan.expectedRows !== null && (!Number.isSafeInteger(plan.expectedRows) || plan.expectedRows < 0)) ||
    !Number.isSafeInteger(plan.maximumAttempts) || plan.maximumAttempts < 1) throw new Error('EXPORT_PLAN_INVALID');
}

function path(scope: string, owner: string, id: string): string {
  const tenant = createHash('sha256').update(scope).digest('hex');
  const identity = createHash('sha256').update(id).digest('hex').slice(0, 32);
  return `tenant/${tenant}/confidential/${owner}/${identity}.csv`;
}

function available(execution: Pick<ExportExecution, 'signal' | 'deadline'>): void {
  if (execution.signal.aborted) throw execution.signal.reason ?? new Error('EXPORT_ABORTED');
  if (Date.now() >= execution.deadline) throw new Error('DEADLINE_EXCEEDED');
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
