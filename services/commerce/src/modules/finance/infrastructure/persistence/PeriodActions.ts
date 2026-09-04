import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { rowResult } from '../../../../adapter/database/DatabaseResult';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../../foundation/application/Validation';
import { AccountingPeriod } from '../../domain/model/AccountingPeriod';
import { AccountingDate } from '../../domain/value/AccountingDate';
import type { FinanceScopeQuery } from './FinanceScopeQuery';
import type { FinanceEntries } from './FinanceOperation';
import { JournalHashQuery } from './JournalHashQuery';

const journalHash = new JournalHashQuery();

export function periodActions(scopes: FinanceScopeQuery): FinanceEntries<'periodsRead' | 'periodsManage'> {
  return {
    periodsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const allowed = await scopes.descendants(database, access.scope);
      const result = await database.query(
        `select period.scope_id,period.period,period.state,period.closed_at,period.closed_by,
        close.id close_id,close.state close_state,close.source_hash,close.requested_by,close.approved_by,close.reason,close.evidence,
        statement.debit_minor,statement.credit_minor,statement.state statement_state from finance.period period
        left join finance.periodclose close on close.scope_id=period.scope_id and close.period=period.period
        left join finance.statement statement on statement.scope_id=period.scope_id
          and to_char(statement.period_start,'YYYY-MM')=period.period and statement.currency='CNY'
        where period.scope_id=any($1::text[])
        and ($2::text is null or period.scope_id||':'||period.period>$2) order by period.scope_id,period.period limit $3`,
        [allowed, page.id, page.fetch]
      );
      return keysetResult(result, page, 'period');
    },
    periodsManage: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const period = request.input.path.period!;
      const accountingDate = AccountingDate.firstOf(period);
      const expectedVersion = request.input.expectedVersion;
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion! < 0) throw new Error('FINANCE_PERIOD_VERSION_INVALID');
      const action = textField(body, 'action', 20);
      if (action === 'request') {
        const target = AccountingPeriod.open(access.scope.id, accountingDate.period).requestClose(access.actor.id).snapshot();
        const result = await database.query(
          `with ${journalHash.cte},
          created as(insert into finance.periodclose(id,scope_id,period,state,source_hash,requested_by,reason,evidence,requested_at,version)
            select 'periodclose:'||encode(public.digest($1||':'||$2,'sha256'),'hex'),period.scope_id,period.period,'pending',current.hash,$3,$4,$5::jsonb,
              clock_timestamp(),0 from finance.period period cross join current where period.scope_id=$1 and period.period=$2 and period.state='open'
              and exists(select 1 from finance.statement where scope_id=$1 and to_char(period_start,'YYYY-MM')=$2 and state='draft')
              and (($6=0 and not exists(select 1 from finance.periodclose prior where prior.scope_id=$1 and prior.period=$2))
                or exists(select 1 from finance.periodclose prior where prior.scope_id=$1 and prior.period=$2 and prior.state='rejected' and prior.version=$6))
            on conflict(scope_id,period) do update set state='pending',source_hash=excluded.source_hash,requested_by=excluded.requested_by,
              approved_by=null,reason=excluded.reason,evidence=excluded.evidence,requested_at=clock_timestamp(),decided_at=null,version=finance.periodclose.version+1
              where finance.periodclose.state='rejected' and finance.periodclose.version=$6 returning *)
          select id,scope_id,period,state,source_hash,requested_by,approved_by,reason,evidence,requested_at,decided_at,version from created`,
          [access.scope.id, period, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(evidence(body.evidence)), expectedVersion]
        );
        if (!result.rows[0]) throw new Error('FINANCE_PERIOD_CLOSE_NOT_REQUESTABLE');
        await database.query(`update finance.period set state=$3 where scope_id=$1 and period=$2 and state='open'`, [access.scope.id, period, target.state]);
        return rowResult(result, 201);
      }
      const decision = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
      if (!decision) throw new Error('FINANCE_PERIOD_ACTION_INVALID');
      const result = await database.query<{ id: string; source_hash: string; requested_by: string; version: number }>(
        `with ${journalHash.cte}
        update finance.periodclose close set state=$3,approved_by=$4,decided_at=clock_timestamp(),reason=$5,evidence=evidence||$6::jsonb,
          version=version+1 from current where close.scope_id=$1 and close.period=$2 and close.state='pending' and close.requested_by<>$4
          and close.source_hash=current.hash and close.version=$7 returning close.*`,
        [access.scope.id, period, decision, access.actor.id, textField(body, 'reason', 1000),
          JSON.stringify({ decisionEvidence: evidence(body.evidence), trace: access.trace }), expectedVersion]
      );
      const close = result.rows[0];
      if (!close) throw new Error('FINANCE_PERIOD_CLOSE_CONFLICT_OR_HASH_MISMATCH');
      const target = AccountingPeriod.restore({ scopeId: access.scope.id, period, state: 'closing', requestedBy: close.requested_by,
        closedAt: null, closedBy: null, version: Number(close.version) - 1 }).decideClose(access.actor.id, decision === 'approved', AccountingDate.of(new Date())).snapshot();
      if (decision === 'approved') {
        await database.query(
          `update finance.period set state=$4,closed_at=clock_timestamp(),closed_by=$3
          where scope_id=$1 and period=$2 and state='closing'`,
          [access.scope.id, period, access.actor.id, target.state]
        );
        const statement = await database.query<{ id: string; period_start: string; period_end: string; currency: string; opening_minor: number; debit_minor: number; credit_minor: number; closing_minor: number; state: string }>(
          `update finance.statement set state='final',generated_at=clock_timestamp()
          where scope_id=$1 and to_char(period_start,'YYYY-MM')=$2 and state='draft'
          returning id,period_start,period_end,currency,opening_minor::float8 opening_minor,debit_minor::float8 debit_minor,
          credit_minor::float8 credit_minor,closing_minor::float8 closing_minor,state`,
          [access.scope.id, period]
        );
        const snapshot = statement.rows[0];
        if (!snapshot) throw new Error('FINANCE_STATEMENT_FINALIZATION_FAILED');
        await appendEvent(database, close.id, access.scope.id, period, close.source_hash, snapshot);
      } else {
        await database.query(`update finance.period set state=$3 where scope_id=$1 and period=$2 and state='closing'`, [access.scope.id, period, target.state]);
      }
      return rowResult(result);
    },
  };
}

async function appendEvent(database: SqlExecutor, close: string, scope: string, period: string, sourceHash: string, statement: Readonly<Record<string, unknown>>): Promise<void> {
  const id = `event:${randomUUID()}`;
  await new PgRuntimeWriter(database).append({ id, type: 'finance.period.closed', aggregateType: 'periodclose', aggregate: close, scope, payload: { period, close, sourceHash, statementSnapshot: {
    statement: statement.id, periodStart: statement.period_start, periodEnd: statement.period_end, currency: statement.currency,
    openingMinor: statement.opening_minor, debitMinor: statement.debit_minor, creditMinor: statement.credit_minor,
    closingMinor: statement.closing_minor, state: statement.state,
  } }, trace: id });
}

function evidence(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}
