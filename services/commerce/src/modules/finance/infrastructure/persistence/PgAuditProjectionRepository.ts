import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AuditProjectionRepository, FinanceAuditFact, FinanceAuditFactKind, FinanceAuditProjection } from '../../application/port/AuditProjectionRepository';

interface AuditFactRow {
  readonly id: string;
  readonly kind: FinanceAuditFactKind;
  readonly label: string;
  readonly business_reference: string;
  readonly state: string | null;
  readonly amount_minor: number | string | null;
  readonly currency: string | null;
  readonly occurred_at: Date | string | null;
  readonly version: number | string | null;
  readonly resources: readonly string[];
}

export class PgAuditProjectionRepository implements AuditProjectionRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async read(context: ReadTransactionContext, scopes: readonly string[], reference: string): Promise<FinanceAuditProjection> {
    if (scopes.length === 0) return empty();
    const result = await this.transactions.database(context).query<AuditFactRow>(SQL, [scopes, reference]);
    const facts = result.rows.map((row) => Object.freeze({
      id: row.id,
      kind: row.kind,
      label: row.label,
      business_reference: row.business_reference,
      state: row.state,
      amount_minor: integer(row.amount_minor),
      currency: row.currency,
      occurred_at: timestamp(row.occurred_at),
      version: integer(row.version),
    } satisfies FinanceAuditFact));
    return Object.freeze({ facts: Object.freeze(facts), resources: Object.freeze([...(result.rows[0]?.resources ?? [])]) });
  }
}

const SQL = `with
basejournal as (
  select journal.id from finance.journal journal where journal.scope_id=any($1::text[])
    and (journal.id=$2 or journal.reference_id=$2)
), baseentry as (
  select entry.id,entry.journal_id from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
  where journal.scope_id=any($1::text[]) and entry.id=$2
), basestatement as (
  select statement.id,statement.object_ref,statement.sha256 from finance.statement statement where statement.scope_id=any($1::text[])
    and (statement.id=$2 or statement.object_ref=$2 or statement.sha256=$2)
), basereconciliation as (
  select reconciliation.id from finance.reconciliation reconciliation where reconciliation.scope_id=any($1::text[])
    and (reconciliation.id=$2 or reconciliation.statement_ref=$2 or reconciliation.statement_hash=$2)
), baseitem as (
  select item.id,item.reconciliation_id,item.statement_line_id from finance.reconciliationitem item
  left join finance.statementline line on line.id=item.statement_line_id
  where item.scope_id=any($1::text[]) and (item.id=$2 or item.internal_id=$2 or line.external_reference=$2)
), basesettlement as (
  select settlement.id,settlement.reconciliation_id from finance.settlement settlement where settlement.scope_id=any($1::text[])
    and (settlement.id=$2 or settlement.reconciliation_id=$2)
), basewithdrawal as (
  select withdrawal.id,withdrawal.settlement_id from finance.withdrawal withdrawal where withdrawal.scope_id=any($1::text[])
    and (withdrawal.id=$2 or withdrawal.provider_reference=$2)
), baseinvoice as (
  select request.id,request.settlement_id from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  left join invoice.document document on document.request_id=request.id where profile.owner_id=any($1::text[])
    and (request.id=$2 or request.settlement_id=$2 or document.id=$2 or document.external_id=$2)
), baserepair as (
  select repair.id,repair.statement_id,repair.source_journal_id,repair.source_reversal_journal_id,repair.replacement_journal_id,repair.rollback_journal_id
  from finance.repair repair where repair.scope_id=any($1::text[])
    and (repair.id=$2 or repair.statement_id=$2 or $2=any(array[repair.source_journal_id,repair.source_reversal_journal_id,repair.replacement_journal_id,repair.rollback_journal_id]))
), reconciliationids as (
  select id from basereconciliation union select reconciliation_id from baseitem
  union select reconciliation_id from basesettlement
  union select settlement.reconciliation_id from finance.settlement settlement join basewithdrawal withdrawal on withdrawal.settlement_id=settlement.id
  union select settlement.reconciliation_id from finance.settlement settlement join baseinvoice request on request.settlement_id=settlement.id
  union select reconciliation.id from finance.reconciliation reconciliation join basestatement statement
    on reconciliation.statement_ref in(statement.id,statement.object_ref,statement.sha256)
  where reconciliation.scope_id=any($1::text[])
), settlementids as (
  select id from basesettlement union select settlement_id from basewithdrawal union select settlement_id from baseinvoice where settlement_id is not null
  union select settlement.id from finance.settlement settlement join reconciliationids reconciliation on reconciliation.id=settlement.reconciliation_id
  where settlement.scope_id=any($1::text[])
), statementids as (
  select id from basestatement union select statement_id from baserepair
  union select statement.id from finance.statement statement join finance.reconciliation reconciliation
    on reconciliation.id in(select id from reconciliationids)
    and reconciliation.statement_ref in(statement.id,statement.object_ref,statement.sha256)
  where statement.scope_id=any($1::text[])
), repairids as (
  select id from baserepair union select repair.id from finance.repair repair join statementids statement on statement.id=repair.statement_id
  where repair.scope_id=any($1::text[])
), invoiceids as (
  select id from baseinvoice union select request.id from invoice.request request join invoice.profile profile on profile.id=request.profile_id
  where profile.owner_id=any($1::text[]) and request.settlement_id in(select id from settlementids)
), withdrawalids as (
  select id from basewithdrawal union select withdrawal.id from finance.withdrawal withdrawal
  where withdrawal.scope_id=any($1::text[]) and withdrawal.settlement_id in(select id from settlementids)
), journalids as (
  select id from basejournal union select journal_id from baseentry
  union select related.journal_id from finance.repair repair cross join lateral unnest(array[
    repair.source_journal_id,repair.source_reversal_journal_id,repair.replacement_journal_id,repair.rollback_journal_id
  ]) related(journal_id) where repair.id in(select id from repairids) and related.journal_id is not null
  union select journal.id from finance.journal journal where journal.scope_id=any($1::text[])
    and journal.reference_id in(
      select id from reconciliationids union select id from settlementids union select id from withdrawalids
      union select id from invoiceids union select id from repairids union select id from statementids
    )
), factrows as (
  select journal.id,'journal'::text kind,'账本凭证'::text label,journal.reference_id business_reference,journal.state,
    sum(case when entry.side='debit' then entry.amount_minor else 0 end)::bigint amount_minor,journal.currency,
    journal.posted_at occurred_at,journal.version from finance.journal journal join journalids selected on selected.id=journal.id
    left join finance.entry entry on entry.journal_id=journal.id group by journal.id
  union all
  select entry.id,'entry',case entry.side when 'debit' then '借方分录 · ' else '贷方分录 · ' end||account.code,
    journal.reference_id,entry.side,entry.amount_minor,account.currency,entry.created_at,null::bigint
    from finance.entry entry join journalids selected on selected.id=entry.journal_id join finance.journal journal on journal.id=entry.journal_id
    join finance.account account on account.id=entry.account_id
  union all
  select statement.id,'statement','账单 · '||statement.period_start::text||' 至 '||statement.period_end::text,
    statement.id,statement.state,statement.closing_minor,statement.currency,statement.generated_at,statement.version
    from finance.statement statement join statementids selected on selected.id=statement.id
  union all
  select reconciliation.id,'reconciliation','对账 · '||reconciliation.provider||' · '||reconciliation.period,
    reconciliation.statement_ref,reconciliation.state,reconciliation.difference_minor,null::char(3),reconciliation.updated_at,reconciliation.version
    from finance.reconciliation reconciliation join reconciliationids selected on selected.id=reconciliation.id
  union all
  select settlement.id,'settlement','结算单 · '||settlement.partner_id||' · '||settlement.period,
    settlement.id,settlement.state,settlement.amount_minor,settlement.currency,
    coalesce(settlement.paid_at,settlement.approved_at,settlement.frozen_at),settlement.version
    from finance.settlement settlement join settlementids selected on selected.id=settlement.id
  union all
  select withdrawal.id,'withdrawal','提现申请',coalesce(withdrawal.provider_reference,withdrawal.id),withdrawal.state,
    withdrawal.amount_minor,withdrawal.currency,withdrawal.updated_at,withdrawal.version
    from finance.withdrawal withdrawal join withdrawalids selected on selected.id=withdrawal.id
  union all
  select request.id,'invoice',case request.kind when 'red' then '红字发票申请' else '发票申请' end,
    coalesce(document.external_id,request.id),request.state,request.amount_minor,request.currency,
    coalesce(document.issued_at,request.created_at),request.version from invoice.request request join invoiceids selected on selected.id=request.id
    left join invoice.document document on document.request_id=request.id
  union all
  select repair.id,'repair','差异修复',repair.statement_id,repair.status,null::bigint,null::char(3),repair.updated_at,repair.version
    from finance.repair repair join repairids selected on selected.id=repair.id
), resources as (
  select resource from (
    select id resource from journalids union select entry.id from finance.entry entry where entry.journal_id in(select id from journalids)
    union select id from statementids union select id from reconciliationids union select id from settlementids
    union select id from withdrawalids union select id from invoiceids union select id from repairids
    union select item.id from finance.reconciliationitem item where item.reconciliation_id in(select id from reconciliationids)
    union select line.id from finance.statementline line where line.reconciliation_id in(select id from reconciliationids)
    union select document.id from invoice.document document where document.request_id in(select id from invoiceids)
  ) related where resource is not null order by resource limit 1000
), bounded as (
  select id,kind,label,business_reference,state,amount_minor,currency,occurred_at,version
  from factrows order by occurred_at desc nulls last,kind,id limit 500
)
select bounded.id,bounded.kind,bounded.label,bounded.business_reference,bounded.state,bounded.amount_minor,bounded.currency,
  bounded.occurred_at,bounded.version,(select coalesce(array_agg(resource order by resource),'{}'::text[]) from resources) resources from bounded
order by occurred_at desc nulls last,kind,id`;

function integer(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('FINANCE_AUDIT_INTEGER_INVALID');
  return parsed;
}

function timestamp(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('FINANCE_AUDIT_TIMESTAMP_INVALID');
  return parsed.toISOString();
}

function empty(): FinanceAuditProjection {
  return Object.freeze({ facts: Object.freeze([]), resources: Object.freeze([]) });
}
