import { createHash } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { BatchImportProcessPort, ImportBatchFactoryPort, ImportExecution, ImportFailure, ImportTarget, JobPort, StoredObject } from '../../../runtime/public';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ImportPort } from '../../../runtime/public';
import type { TaskAuthorizationPort } from '../../../access/public/TaskAuthorizationPort';
import { statementImportMetadata } from '../../domain/value/StatementImport';
import { statementLine } from '../../domain/value/StatementLine';
import { Statement } from '../../domain/model/Statement';

interface StatementSummary {
  readonly opening: number | string;
  readonly debit: number | string;
  readonly credit: number | string;
  readonly closing: number | string;
  readonly rows: number | string;
}

export class PgStatementImportProcess implements BatchImportProcessPort {
  private readonly delegate: BatchImportProcessPort;
  private readonly access = new PgTransactionAccess();

  constructor(
    factory: ImportBatchFactoryPort,
    private readonly transactions: TransactionManager,
    private readonly runtime: ImportPort,
    private readonly jobs: JobPort,
    authorization: TaskAuthorizationPort
  ) {
    this.delegate = factory.create({
      owner: 'finance',
      failure: 'FINANCE_IMPORT_ROW_FAILED',
      transactions,
      runtime,
      authorization,
      write: (context, target, row, value) => this.write(context, target, row, value),
      continue: (context, target, sequence) =>
        jobs
          .create(context, {
            idempotency: `${target.id}:${sequence}`,
            kind: 'financeimport',
            owner: 'finance',
            scope: target.scope,
            queue: 'import',
            payload: Object.freeze({ import: target.id }),
            actor: 'system:finance',
          })
          .then(() => undefined),
      publish: (target, report, execution) => this.publish(target, report, execution),
    });
  }

  find(id: string, execution: ImportExecution): Promise<ImportTarget | null> {
    return this.delegate.find(id, execution);
  }

  authorize(target: ImportTarget, execution: ImportExecution): Promise<void> {
    return this.delegate.authorize(target, execution);
  }

  stage(target: ImportTarget, rows: Iterable<Readonly<Record<string, string>>> | AsyncIterable<Readonly<Record<string, string>>>, execution: ImportExecution): Promise<void> {
    statementMeta(target);
    return this.delegate.stage(target, rows, execution);
  }

  process(target: ImportTarget, signal: AbortSignal, deadline: number): Promise<boolean> {
    return this.delegate.process(target, signal, deadline);
  }

  failures(target: ImportTarget, execution: ImportExecution): Promise<readonly ImportFailure[]> {
    return this.delegate.failures(target, execution);
  }

  report(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    return this.delegate.report(target, report, execution);
  }

  async complete(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    return this.delegate.complete(target, report, execution);
  }

  private async publish(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    const meta = statementMeta(target);
    const options = transactionOptions(target, execution);
    await this.transactions.write(options, async (context) => {
      const database = this.access.database(context);
      const id = statementId(target.id);
      const reconciliation = reconciliationId(target.id);
      const selected = await database.query<StatementSummary>(
        `select $1::bigint opening,
          coalesce(sum(case when line.kind='payment' then line.amount_minor else 0 end),0) debit,
          coalesce(sum(case when line.kind='refund' then line.amount_minor else 0 end),0) credit,$2::bigint closing,
          count(line.sequence) rows from finance.statementimportline line where line.import_id=$3 and line.scope_id=$4`,
        [meta.opening, meta.closing, target.id, target.scope]
      );
      const summary = selected.rows[0];
      if (!summary) throw new Error('FINANCE_IMPORT_SUMMARY_MISSING');
      const progress = await this.runtime.progress(context, target.id, 'finance');
      if (!progress) throw new Error('FINANCE_IMPORT_PROGRESS_MISSING');
      const failed = progress.failed;
      const rows = Number(summary.rows);
      if (failed > 0 || rows <= 0) {
        await this.runtime.reject(context, target.id, 'finance', 'FINANCE_IMPORT_ROWS_INVALID', `${failed} rows failed validation`);
        return;
      }
      const opening = Number(summary.opening);
      const debit = Number(summary.debit);
      const credit = Number(summary.credit);
      const closing = Number(summary.closing);
      if (![opening, debit, credit, closing].every(Number.isSafeInteger) || opening + debit - credit !== closing || closing !== meta.closing) {
        await this.runtime.reject(context, target.id, 'finance', 'FINANCE_STATEMENT_TOTAL_MISMATCH', 'statement totals do not balance');
        return;
      }
      const statement = Statement.draft({
        id,
        scopeId: target.scope,
        periodStart: meta.start,
        periodEnd: meta.end,
        currency: meta.currency,
        openingMinor: opening,
        debitMinor: debit,
        creditMinor: credit,
        closingMinor: closing,
        objectRef: target.reference,
        sha256: target.sha256,
        generatedAt: new Date().toISOString(),
        version: 1,
      }).snapshot();
      const statementCreated = await database.query(
        `insert into finance.statement(id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,state,
          object_ref,sha256,generated_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,clock_timestamp(),1)
         on conflict(id) do nothing returning id`,
        [statement.id, statement.scopeId, statement.periodStart, statement.periodEnd, statement.currency, statement.openingMinor, statement.debitMinor, statement.creditMinor, statement.closingMinor, statement.objectRef, statement.sha256]
      );
      if (statementCreated.rowCount !== 1) throw new Error('FINANCE_STATEMENT_DUPLICATE');
      const maker = importMaker(target.authorization);
      const reconciliationCreated = await database.query(
        `insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,created_by,evidence)
         values($1,$2,$3,$4,$5,$6,$7,'received',$8,jsonb_build_object('source','runtimeimport','statementId',$9,'importId',$10))
         on conflict(id) do nothing returning id`,
        [reconciliation, target.scope, meta.provider, meta.partner, meta.period, target.reference, target.sha256, maker, id, target.id]
      );
      if (reconciliationCreated.rowCount !== 1) throw new Error('FINANCE_RECONCILIATION_DUPLICATE');
      const lines = await database.query(
        `insert into finance.statementline(id,reconciliation_id,scope_id,sequence,external_reference,kind,amount_minor,tax_minor,currency,occurred_at,raw_hash)
         select 'statementline:'||substr(encode(public.digest(line.import_id||':'||line.sequence::text,'sha256'),'hex'),1,32),$1,line.scope_id,
           line.sequence,line.external_reference,line.kind,line.amount_minor,line.tax_minor,line.currency,line.occurred_at,line.raw_hash
         from finance.statementimportline line where line.import_id=$2 and line.scope_id=$3 order by line.sequence returning id`,
        [reconciliation, target.id, target.scope]
      );
      if (lines.rowCount !== rows) throw new Error('FINANCE_IMPORT_ROW_COUNT_MISMATCH');
      await this.runtime.complete(context, target.id, 'finance', report);
      await this.jobs.create(context, {
        idempotency: `${target.id}:reconciliation`,
        kind: 'reconciliation',
        owner: 'finance',
        scope: target.scope,
        queue: 'finance',
        payload: Object.freeze({ reconciliation }),
        actor: 'system:finance',
      });
      await database.query(`delete from finance.statementimportline where import_id=$1 and scope_id=$2`, [target.id, target.scope]);
    });
  }

  reject(target: ImportTarget, code: string, detail: string, execution: ImportExecution): Promise<void> {
    return this.delegate.reject(target, code, detail, execution);
  }

  fault(target: ImportTarget, detail: string, execution: ImportExecution): Promise<void> {
    return this.delegate.fault(target, detail, execution);
  }

  private async write(context: WriteTransactionContext, target: ImportTarget, row: number, value: Readonly<Record<string, string>>): Promise<void> {
    const meta = statementMeta(target);
    const item = statementLine(value, meta.currency);
    const database = this.access.database(context);
    try {
      const result = await database.query(
        `insert into finance.statementimportline(import_id,scope_id,sequence,external_reference,kind,amount_minor,tax_minor,currency,occurred_at,raw_hash)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(import_id,sequence) do nothing returning sequence`,
        [target.id, target.scope, row - 1, item.reference, item.kind, item.amount, item.tax, meta.currency, item.occurred, digest(JSON.stringify(value))]
      );
      if (result.rowCount === 0) {
        const existing = await database.query(`select 1 from finance.statementimportline where import_id=$1 and scope_id=$2 and sequence=$3`, [target.id, target.scope, row - 1]);
        if (!existing.rows[0]) throw new Error('FINANCE_IMPORT_ROW_FAILED');
      }
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && Reflect.get(cause, 'code') === '23505') throw new Error('FINANCE_IMPORT_REFERENCE_DUPLICATE');
      throw cause;
    }
  }
}

function statementMeta(target: ImportTarget) {
  const metadata = statementImportMetadata(target.metadata ?? {});
  return Object.freeze({
    provider: metadata.provider,
    partner: metadata.partnerId,
    start: metadata.periodStart,
    end: metadata.periodEnd,
    period: `${metadata.periodStart}/${metadata.periodEnd}`,
    currency: metadata.currency,
    opening: metadata.openingMinor,
    closing: metadata.closingMinor,
  });
}

function transactionOptions(target: ImportTarget, execution: ImportExecution) {
  return { tenant: target.scope, membership: '', scope: target.scope, actor: 'job:financeimport', trace: target.id, operation: 'job.finance.import', workload: 'jobs' as const, signal: execution.signal, deadline: execution.deadline };
}

function statementId(value: string): string {
  return `statement:${digest(value)}`;
}
function reconciliationId(value: string): string {
  return `reconciliation:${digest(value)}`;
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
function importMaker(evidence: Readonly<Record<string, unknown>>): string {
  const maker = evidence.membership;
  if (typeof maker !== 'string' || !/^membership:[A-Za-z0-9:.-]+$/.test(maker)) throw new Error('FINANCE_IMPORT_MAKER_INVALID');
  return maker;
}
