import type { BatchImportProcessPort, ImportBatchConfiguration, ImportCandidate, ImportExecution, ImportFailure, ImportPreparedBatch, ImportTarget } from '../../public/ImportProcess';
import { importCode, importDetail, taskFailure } from '../../domain/value/Failure';
import { ImportItem } from '../../domain/model/ImportItem';
import type { StoredObject } from '../../public/ObjectPort';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import { IMPORT_CAPACITY } from '@shop/config/runtime';

export class RuntimeBatchImportProcess implements BatchImportProcessPort {
  constructor(private readonly value: ImportBatchConfiguration) {
    if (value.concurrency !== undefined && (!Number.isSafeInteger(value.concurrency) || value.concurrency < 1 || value.concurrency > IMPORT_CAPACITY.maximumConcurrentRows)) {
      throw new Error('IMPORT_CONCURRENCY_INVALID');
    }
  }

  find(id: string, execution: ImportExecution): Promise<ImportTarget | null> {
    return this.value.transactions.read(options(this.value, { id, scope: execution.scope }, execution),
      (context) => this.value.runtime.find(context, id, this.value.owner));
  }

  authorize(target: ImportTarget, execution: ImportExecution): Promise<void> {
    return this.value.transactions.read(options(this.value, target, execution),
      (context) => this.value.authorization.assert(context, target.authorization));
  }

  async stage(target: ImportTarget, rows: Iterable<Readonly<Record<string, string>>> | AsyncIterable<Readonly<Record<string, string>>>, execution: ImportExecution): Promise<void> {
    const transaction = options(this.value, target, execution);
    const cursor = await this.value.transactions.write(transaction, (context) => this.value.runtime.begin(context, target.id, this.value.owner));
    if (!Number.isSafeInteger(cursor.sequence) || cursor.sequence < 0 || !Number.isSafeInteger(cursor.staged) || cursor.staged < 0 ||
      (cursor.size !== undefined && (!Number.isSafeInteger(cursor.size) || cursor.size < 1 || cursor.size > IMPORT_CAPACITY.chunkRows))) {
      throw new Error('RUNTIME_IMPORT_STAGE_CONFLICT');
    }
    let total = 0;
    let sequence = cursor.sequence;
    let size = cursor.size ?? IMPORT_CAPACITY.chunkRows;
    let columns: readonly string[] = Object.freeze([]);
    let candidates: { row: number; value: Readonly<Record<string, string>> }[] = [];
    for await (const value of rows) {
      if (execution.signal.aborted) throw execution.signal.reason ?? new Error('IMPORT_ABORTED');
      if (Date.now() >= execution.deadline) throw new Error('DEADLINE_EXCEEDED');
      total += 1;
      if (total === 1) columns = Object.freeze(Object.keys(value).sort());
      else if (!sameColumns(columns, value)) throw new Error('CSV_COLUMNS_CHANGED');
      if (total <= cursor.staged) continue;
      candidates.push({ row: total + 1, value });
      if (candidates.length >= size) {
        await this.authorize(target, execution);
        size = await this.stageChunk(transaction, target, execution, sequence, candidates, size);
        sequence += 1;
        candidates = [];
      }
    }
    if (total === 0) throw new Error('IMPORT_FILE_EMPTY');
    if (cursor.staged > total) throw new Error('RUNTIME_IMPORT_STAGE_CONFLICT');
    if (candidates.length > 0) {
      await this.authorize(target, execution);
      await this.stageChunk(transaction, target, execution, sequence, candidates, size);
    }
    await this.value.transactions.write(transaction,
      (context) => this.value.runtime.ready(context, target.id, this.value.owner, total, columns));
  }

  async process(target: ImportTarget, signal: AbortSignal, deadline: number): Promise<boolean> {
    const execution = Object.freeze({ scope: target.scope, signal, deadline });
    const transaction = options(this.value, target, execution);
    let nextSequence = 0;
    while (Date.now() < deadline - 2_000) {
      await this.authorize(target, execution);
      const chunk = await this.value.transactions.write(transaction,
        (context) => this.value.runtime.claim(context, target.id, this.value.owner, IMPORT_CAPACITY.chunkLeaseSeconds));
      if (!chunk) return true;
      nextSequence = chunk.sequence + 1;
      let outcomes: readonly (ImportFailure | null)[];
      try {
        outcomes = await mapParallel(chunk.rows, this.concurrency(), async (row): Promise<ImportFailure | null> => {
          if (signal.aborted) throw signal.reason;
          try {
            await this.value.transactions.write(transaction, async (context) => {
              await this.value.runtime.assertLease(context, target.id, this.value.owner, chunk.sequence, chunk.token);
              await this.value.write(context, target, row.row, row.payload);
            });
            return null;
          } catch (cause) {
            if (!ownedRowFailure(cause, this.value.owner)) throw cause;
            return Object.freeze({ row: row.row, reason: importCode(cause, this.value.failure), field: null, detail: importDetail(cause) });
          }
        });
      } catch (cause) {
        await this.value.transactions.write(transaction, (context) => this.value.runtime.abandon(
          context, target.id, this.value.owner, chunk.sequence, chunk.token, importDetail(cause))).catch(() => undefined);
        throw cause;
      }
      const failures = outcomes.filter((outcome): outcome is ImportFailure => outcome !== null).map((failure) => {
        new ImportItem(failure.row, 'failed', taskFailure(failure.reason, false, new Date().toISOString()));
        return failure;
      });
      const complete = await this.value.transactions.write(transaction,
        (context) => this.value.runtime.finish(context, target.id, this.value.owner, chunk.sequence, chunk.token, chunk.rows.length - failures.length, failures));
      if (complete) return true;
    }
    await this.value.transactions.write(transaction, (context) => this.value.continue(context, target, nextSequence));
    return false;
  }

  failures(target: ImportTarget, execution: ImportExecution): Promise<readonly ImportFailure[]> {
    return this.value.transactions.read(options(this.value, target, execution), (context) => this.value.runtime.failures(context, target.id, this.value.owner));
  }
  report(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    return this.value.transactions.write(options(this.value, target, execution), (context) => this.value.runtime.report(context, target.id, this.value.owner, report));
  }
  complete(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    if (this.value.publish) return this.value.publish(target, report, execution);
    return this.value.transactions.write(options(this.value, target, execution), (context) => this.value.runtime.complete(context, target.id, this.value.owner, report));
  }
  reject(target: ImportTarget, code: string, detail: string, execution: ImportExecution): Promise<void> {
    return this.value.transactions.write(options(this.value, target, execution), (context) => this.value.runtime.reject(context, target.id, this.value.owner, code, detail));
  }
  fault(target: ImportTarget, detail: string, execution: ImportExecution): Promise<void> {
    return this.value.transactions.write(options(this.value, target, execution), (context) => this.value.runtime.fault(context, target.id, this.value.owner, detail));
  }

  private concurrency(): number { return this.value.concurrency ?? IMPORT_CAPACITY.maximumConcurrentRows; }

  private async stageChunk(
    transaction: ReturnType<typeof options>,
    target: ImportTarget,
    execution: ImportExecution,
    sequence: number,
    candidates: readonly { row: number; value: Readonly<Record<string, string>> }[],
    size: number
  ): Promise<number> {
    const started = performance.now();
    const source = Object.freeze(candidates.map(({ row, value }): ImportCandidate => Object.freeze({ row, value })));
    const prepared = this.value.prepare ? await this.value.prepare(target, source, execution) : identityBatch(source);
    assertPrepared(source, prepared);
    const chunk = Object.freeze({ sequence, rows: Object.freeze([...prepared.rows]) });
    await this.value.transactions.write(transaction,
      (context) => this.value.runtime.stage(context, target.id, this.value.owner, [chunk], prepared.failures));
    return adaptiveSize(size, performance.now() - started);
  }
}

function identityBatch(rows: readonly ImportCandidate[]): ImportPreparedBatch {
  return Object.freeze({ rows: Object.freeze(rows.map(({ row, value }) => Object.freeze({ row, payload: value }))), failures: Object.freeze([]) });
}

function assertPrepared(source: readonly ImportCandidate[], prepared: ImportPreparedBatch): void {
  const expected = source.map(({ row }) => row);
  const actual = prepared.rows.map(({ row }) => row);
  const failures = prepared.failures.map(({ row, reason }) => `${row}:${reason}`);
  if (actual.length !== expected.length || actual.some((row, index) => row !== expected[index]) || new Set(failures).size !== failures.length ||
    prepared.failures.some(({ row }) => !expected.includes(row)) || prepared.failures.some(({ reason, field, detail }) =>
      !/^[A-Z][A-Z0-9_]{2,127}$/.test(reason) || (field !== null && (field.length < 1 || field.length > 128)) || detail.length > 500)) {
    throw new Error('IMPORT_PREFLIGHT_INVALID');
  }
}

function sameColumns(columns: readonly string[], value: Readonly<Record<string, string>>): boolean {
  const candidate = Object.keys(value).sort();
  return candidate.length === columns.length && candidate.every((column, index) => column === columns[index]);
}

function adaptiveSize(current: number, milliseconds: number): number {
  if (milliseconds > 750) return Math.max(100, Math.floor(current / 2));
  if (milliseconds < 150) return Math.min(IMPORT_CAPACITY.chunkRows, Math.max(100, Math.ceil(current * 1.25)));
  return current;
}

function ownedRowFailure(cause: unknown, owner: string): boolean {
  const code = importCode(cause, '');
  return code === 'VALIDATION_FAILED' || code.startsWith(`${owner.toUpperCase()}_`);
}

function options(configuration: Pick<ImportBatchConfiguration, 'owner'>, target: Pick<ImportTarget, 'id' | 'scope'>,
  execution: Pick<ImportExecution, 'signal' | 'deadline'>) {
  return { tenant: target.scope, membership: '', scope: target.scope, actor: `job:${configuration.owner}import`, trace: target.id,
    operation: `job.${configuration.owner}.import`, workload: 'jobs' as const, signal: execution.signal, deadline: execution.deadline };
}
