import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { ExportExecution, ExportPageRow, ExportPlan, ExportRenderer, ExportResult } from '../../../runtime/public';
import { exportHeader, type ExportJob } from '../../domain/model/ExportJob';
import type { ReportingJobRepository } from '../port/ReportingJobRepository';

const PAGE_ROWS = 1000;

interface ReportPlan extends ExportPlan {
  readonly export: ExportJob;
  readonly execution: ExportExecution;
}

export class ExportReport implements ExportRenderer<ReportPlan> {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ReportingJobRepository,
    private readonly maximumAttempts: number
  ) {
    if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1) throw new Error('REPORT_EXPORT_ATTEMPTS_INVALID');
  }

  async open(id: string, execution: ExportExecution): Promise<ReportPlan | null> {
    const selected = await this.transactions.write(options(execution), (context) => this.repository.claimExport(context, id));
    if (selected === null) return null;
    return Object.freeze({
      id,
      owner: 'reporting',
      columns: exportHeader(selected.report),
      cursor: selected.cursor,
      pageRows: PAGE_ROWS,
      expectedRows: null,
      maximumAttempts: this.maximumAttempts,
      export: selected,
      execution,
    });
  }

  prepare(plan: ReportPlan): Promise<number | null> {
    if (plan.export.scope !== plan.execution.scope) throw new Error('REPORT_EXPORT_SCOPE_MISMATCH');
    return this.transactions.read(options(plan.execution), (context) => this.repository.exportCount(context, plan.id, plan.export.report));
  }

  async read(plan: ReportPlan, cursor: string | null, fetch: number): Promise<readonly ExportPageRow[]> {
    const rows = await this.transactions.read(options(plan.execution), (context) => this.repository.exportRows(context, plan.id, plan.export.report, cursor, fetch));
    return Object.freeze(rows.map((row) => Object.freeze({ cursor: row.key, cells: Object.freeze([...row.values]) })));
  }

  advance(plan: ReportPlan, cursor: string, count: number): Promise<void> {
    return this.transactions.write(options(plan.execution), (context) => this.repository.advanceExport(context, plan.id, cursor, count));
  }

  complete(plan: ReportPlan, result: ExportResult): Promise<void> {
    return this.transactions.write(options(plan.execution), (context) => this.repository.completeExport(context, plan.id, result.object));
  }

  fail(plan: ReportPlan, code: string, terminal: boolean): Promise<void> {
    return this.transactions.write(options(plan.execution), (context) => this.repository.failExport(context, plan.id, code, terminal));
  }

  retryable(): boolean {
    return true;
  }
}

function options(execution: ExportExecution): TransactionOptions {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:export',
    trace: execution.trace,
    operation: 'job.reporting.export',
    workload: 'jobs',
    signal: execution.signal,
    deadline: execution.deadline,
  };
}
