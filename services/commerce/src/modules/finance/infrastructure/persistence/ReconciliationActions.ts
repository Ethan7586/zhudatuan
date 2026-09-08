/** Finance reconciliation persistence. */
import { createHash } from 'node:crypto';
import type { TabularFilePort } from '../../../runtime/public';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { FinanceChannelPort } from '../../../channel/public';
import type { FinanceFulfillmentPort } from '../../../fulfillment/public';
import type { FinancePaymentPort } from '../../../payment/public';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../platform/database/PgRuntimeWriter';
import { statementLine, type NormalizedStatementLine } from '../../domain/value/StatementLine';
import { Reconciliation } from '../../domain/model/Reconciliation';
import type { ReconciliationOutcome } from '../../application/port/ReconciliationProcess';
import { ReconciliationPolicy } from '../../domain/policy/ReconciliationPolicy';

import { difference, ingest, lineSummary, match, transactionOptions, type ReconciliationMatch, type Source } from './ReconciliationStore';
export class ReconcileStatement {
  private readonly access = new PgTransactionAccess();
  private readonly policy = new ReconciliationPolicy();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly files: TabularFilePort,
    private readonly channel: FinanceChannelPort,
    private readonly payments: FinancePaymentPort,
    private readonly fulfillments: FinanceFulfillmentPort
  ) {}

  async execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<ReconciliationOutcome> {
    const options = transactionOptions(id, scope, signal, deadline);
    const prepared = await this.transactions.read(options, async (context) => {
      const database = this.access.database(context);
      const loaded = await database.query<Source>(
        `select target.scope_id,target.provider,target.partner_id,target.period,target.created_by,target.statement_hash,target.statement_ref,
          target.debit_minor::float8 reconciliation_debit,target.credit_minor::float8 reconciliation_credit,
          target.difference_minor::float8 reconciliation_difference,target.version::float8 version,statement.id statement_id,
          statement.sha256 local_hash,
          statement.debit_minor local_debit,statement.credit_minor local_credit,
          (select policy.rule from finance.policy policy where policy.scope_id=target.scope_id and policy.kind='threshold'
            and policy.state='active' order by policy.version desc,policy.id limit 1) threshold_rule,
          (select count(*)::integer from finance.statementline line where line.reconciliation_id=target.id) line_count
         from finance.reconciliation target left join finance.statement statement on statement.id=target.evidence->>'statementId'
         where target.id=$1 and target.state in('received','matching','difference')`,
        [id]
      );
      const source = loaded.rows[0];
      if (!source) throw new Error('RECONCILIATION_NOT_RUNNABLE');
      if (source.line_count > 0) {
        if (!source.statement_id || source.local_hash !== source.statement_hash) throw new Error('STATEMENT_INTEGRITY_FAILED');
        return Object.freeze({ source, statement: null });
      }
      const statement = await this.channel.statement(context, source.statement_ref, source.scope_id);
      if (!statement || statement.sha256 !== source.statement_hash) throw new Error('STATEMENT_INTEGRITY_FAILED');
      return Object.freeze({ source, statement });
    });
    const { source, statement } = prepared;
    await this.transactions.write(options, async (context) => {
      const claimed = await this.access.database(context).query(
        `update finance.reconciliation set state='matching',updated_at=clock_timestamp()
      where id=$1 and state in('received','matching','difference') returning id`,
        [id]
      );
      if (!claimed.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
    });
    return this.transactions.write(options, async (context) => {
      const client = this.access.database(context);
      if (statement) await ingest(client, this.files, id, source.scope_id, statement.objectRef, source.statement_hash);
      const lines = await lineSummary(client, id);
      if (lines.count < 1) throw new Error('STATEMENT_FILE_EMPTY');
      if (source.local_debit !== null && source.local_credit !== null && (Number(source.local_debit) !== lines.payments || Number(source.local_credit) !== lines.refunds)) throw new Error('STATEMENT_TOTAL_MISMATCH');
      const references = Object.freeze(lines.references);
      const [payments, fulfillments] = await Promise.all([this.payments.reconciliation(context, references), this.fulfillments.reconciliation(context, references)]);
      await match(client, id, source.scope_id, Object.freeze([...payments, ...fulfillments]));
      const internal = await client.query<{ net: number; differences: number; maximum: number }>(
        `select coalesce(sum(case line.kind when 'refund' then
          -item.internal_minor when 'fee' then -item.internal_minor else item.internal_minor end),0)::float8 net,
        count(*) filter(where item.state='difference')::integer differences,
        coalesce(max(abs(item.difference_minor)) filter(where item.state='difference'),0)::float8 maximum from finance.reconciliationitem item
        join finance.statementline line on line.id=item.statement_line_id where item.reconciliation_id=$1`,
        [id]
      );
      const summary = internal.rows[0]!;
      const providerNet = lines.payments - lines.refunds;
      const completed = Reconciliation.restore({
        id,
        scopeId: source.scope_id,
        provider: source.provider,
        partnerId: source.partner_id,
        period: source.period,
        statementRef: source.statement_ref,
        statementHash: source.statement_hash,
        state: 'matching',
        externalMinor: Number(source.reconciliation_debit),
        internalMinor: Number(source.reconciliation_credit),
        differenceMinor: Number(source.reconciliation_difference),
        differenceCount: 0,
        requestedBy: source.created_by,
        approvedBy: null,
        version: Number(source.version),
      })
        .complete(providerNet, summary.net, summary.differences)
        .snapshot();
      const result = await client.query(
        `update finance.reconciliation set debit_minor=$2,credit_minor=$3,difference_minor=$4,
        evidence=$5::jsonb,state=$6,updated_at=clock_timestamp(),
        version=version+1 where id=$1 and state='matching' and version=$7 returning *`,
        [
          id,
          completed.externalMinor,
          completed.internalMinor,
          completed.differenceMinor,
          JSON.stringify({
            rowCount: lines.count,
            provider: { payments: lines.payments, refunds: lines.refunds },
            internalNet: summary.net,
            differences: summary.differences,
            maximumDifferenceMinor: summary.maximum,
            statementHash: source.statement_hash,
          }),
          completed.state,
          Number(source.version),
        ]
      );
      if (!result.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
      if (completed.state === 'difference') await difference(client, id, source.scope_id, completed.differenceMinor, summary.differences);
      if (completed.state !== 'balanced' && completed.state !== 'difference') throw new Error('RECONCILIATION_RESULT_INVALID');
      return Object.freeze({
        id,
        scopeId: source.scope_id,
        makerId: source.created_by,
        statementHash: source.statement_hash,
        externalMinor: completed.externalMinor,
        internalMinor: completed.internalMinor,
        differenceMinor: completed.differenceMinor,
        differenceCount: summary.differences,
        maximumDifferenceMinor: Number(summary.maximum),
        thresholdMinor: this.policy.threshold(source.threshold_rule ?? { amountMinor: 0 }),
        version: completed.version,
        state: completed.state,
      });
    });
  }
}
