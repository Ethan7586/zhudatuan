import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const FINANCE_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'finance.entries.read',
  'finance.statements.read',
  'finance.reconciliations.read',
  'finance.settlements.read',
  'finance.withdrawals.read',
  'invoice.requests.read',
] as const satisfies readonly OperationId[]);

export function financeOperatorReadActions(): OperationActions {
  return {
    'finance.entries.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select entry.id,entry.side,entry.amount_minor,account.code,account.currency,
        journal.reference_type,journal.reference_id,journal.description,journal.posted_at from finance.entry entry
        join finance.account account on account.id=entry.account_id join finance.journal journal on journal.id=entry.journal_id
        where account.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1) and journal.state='posted'
        and ($2::timestamptz is null or (journal.posted_at,entry.id)<($2::timestamptz,$3))
        order by journal.posted_at desc,entry.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'posted_at');
    },
    'finance.statements.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select statement.*,
        coalesce((select jsonb_agg(jsonb_build_object(
          'accountId',line.account_id,'accountCode',line.account_code,'accountKind',line.account_kind,
          'openingDebitMinor',line.opening_debit_minor::text,'openingCreditMinor',line.opening_credit_minor::text,
          'periodDebitMinor',line.period_debit_minor::text,'periodCreditMinor',line.period_credit_minor::text,
          'closingDebitMinor',line.closing_debit_minor::text,'closingCreditMinor',line.closing_credit_minor::text,
          'sourceHash',line.source_hash
        ) order by line.account_code,line.account_id)
        from finance.statementaccount line where line.statement_id=statement.id),'[]'::jsonb) accounts
        from finance.statement statement where statement.scope_id in(
          select descendant_id from organization.unitclosure where ancestor_id=$1)
        and statement.state in('draft','final') and statement.calculation_version=2 and statement.balanced
        and ($2::date is null or (statement.period_end,statement.id)<($2::date,$3))
        order by statement.period_end desc,statement.id desc limit $4`,
      [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'period_end');
    },
    'finance.reconciliations.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const q = queryText(request.input.query, 'q', 200);
      const period = queryPeriod(request.input.query);
      const provider = queryText(request.input.query, 'channel', 64);
      const scope = queryText(request.input.query, 'mall', 200);
      const state = queryChoice(request.input.query, 'status', ['received', 'matching', 'balanced', 'difference', 'pending-review', 'resolved', 'approved'] as const);
      const difference = queryText(request.input.query, 'difference', 100);
      const kind = queryChoice(request.input.query, 'kind', ['payment', 'refund'] as const);
      const result = await database.query(
        `select reconciliation.*,
        coalesce((select jsonb_object_agg(state,count) from (select state,count(*) count from finance.reconciliationitem item
          where item.reconciliation_id=reconciliation.id group by state) states),'{}'::jsonb) item_counts,
        coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'externalMinor',item.external_minor,'internalMinor',item.internal_minor,
          'differenceMinor',item.difference_minor,'kind',item.kind,'internalType',item.internal_type,'internalId',item.internal_id,
          'statementLineId',item.statement_line_id,'state',item.state,'reasonCode',item.reason_code,'evidence',item.evidence,
          'resolution',item.resolution,'resolvedBy',item.resolved_by,'approvedBy',item.approved_by,'version',item.version) order by item.id)
          from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id),'[]'::jsonb) items
        from finance.reconciliation reconciliation where access.scope_allowed(reconciliation.scope_id)
        and reconciliation.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::text is null or reconciliation.id>$2)
        and ($4::text is null or position(lower($4) in lower(concat_ws(' ',reconciliation.id,reconciliation.statement_ref,
          reconciliation.partner_id,reconciliation.provider)))>0 or exists(select 1 from finance.reconciliationitem item
            where item.reconciliation_id=reconciliation.id
            and position(lower($4) in lower(concat_ws(' ',item.id,item.internal_id)))>0))
        and ($5::text is null or reconciliation.period=$5)
        and ($6::text is null or reconciliation.provider=$6)
        and ($7::text is null or reconciliation.scope_id=$7)
        and ($8::text is null or reconciliation.state=$8 or ($8='pending-review' and exists(
          select 1 from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id
            and item.state='resolutionpending')))
        and ($9::text is null or ($9='none' and not exists(select 1 from finance.reconciliationitem item
              where item.reconciliation_id=reconciliation.id and item.state<>'matched'))
          or exists(select 1 from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id
            and item.reason_code=$9))
        and ($10::text is null or exists(select 1 from finance.reconciliationitem item
          where item.reconciliation_id=reconciliation.id and item.kind=$10))
        order by reconciliation.id limit $3`,
        [access.scope.id, page.id, page.fetch, q, period, provider, scope, state, difference, kind]
      );
      return keysetResult(result, page, 'id');
    },
    'finance.settlements.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select settlement.*,
        coalesce((select jsonb_agg(jsonb_build_object('id',line.id,'sourceType',line.source_type,'sourceId',line.source_id,
          'amountMinor',line.amount_minor,'taxMinor',line.tax_minor,'state',line.state,'adjustmentOf',line.adjustment_of) order by line.id)
          from finance.settlementline line where line.settlement_id=settlement.id),'[]'::jsonb) lines
        ,coalesce((select jsonb_agg(jsonb_build_object('id',split.id,'beneficiaryType',split.beneficiary_type,
          'beneficiaryId',split.beneficiary_id,'amountMinor',split.amount_minor,'basisPoints',split.basis_points,'state',split.state) order by split.id)
          from finance.split split where split.settlement_id=settlement.id),'[]'::jsonb) splits
        ,coalesce((select jsonb_agg(jsonb_build_object('id',adjustment.id,'line',adjustment.settlement_line_id,
          'direction',adjustment.direction,'amountMinor',adjustment.amount_minor,'taxMinor',adjustment.tax_minor,'state',adjustment.state,
          'requestedBy',adjustment.requested_by,'approvedBy',adjustment.approved_by,'reason',adjustment.reason,'evidence',adjustment.evidence)
          order by adjustment.created_at,adjustment.id) from finance.settlementadjustment adjustment
          where adjustment.settlement_id=settlement.id),'[]'::jsonb) adjustments
        from finance.settlement settlement where access.scope_allowed(settlement.scope_id)
        and settlement.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::text is null or settlement.id>$2) order by settlement.id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    'finance.withdrawals.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select withdrawal.* from finance.withdrawal withdrawal where access.scope_allowed(withdrawal.scope_id)
        and withdrawal.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::timestamptz is null or (withdrawal.created_at,withdrawal.id)<($2::timestamptz,$3))
        order by withdrawal.created_at desc,withdrawal.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
    'invoice.requests.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select request.*,document.object_ref,document.sha256,document.issued_at,
        coalesce((select jsonb_agg(jsonb_build_object('settlementLine',line.settlement_line_id,
          'amountMinor',line.amount_minor,'taxMinor',line.tax_minor,'sourceHash',line.source_hash)
          order by line.settlement_line_id) from invoice.requestline line where line.request_id=request.id),'[]'::jsonb) lines
        from invoice.request request join invoice.requestprofile snapshot on snapshot.request_id=request.id
        left join invoice.document document on document.request_id=request.id where snapshot.owner_id=$1
        and ($2::timestamptz is null or (request.created_at,request.id)<($2::timestamptz,$3))
        order by request.created_at desc,request.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'created_at');
    },
  };
}

export function financeOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('finance', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    financeOperatorReadActions(), FINANCE_OPERATOR_READ_OPERATION_IDS);
}

function queryText(query: Readonly<Record<string, unknown>>, field: string, maximum: number): string | null {
  const raw = query[field];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum) {
    throw new Error(`VALIDATION_FAILED:${field}`);
  }
  return value.trim();
}

function queryPeriod(query: Readonly<Record<string, unknown>>): string | null {
  const value = queryText(query, 'period', 21);
  if (value === null) return null;
  const match = /^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\/(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/.exec(value);
  if (!match || !canonicalDate(match[1]!) || !canonicalDate(match[2]!) || match[1]! > match[2]!) {
    throw new Error('FINANCE_QUERY_PERIOD_INVALID');
  }
  return value;
}

function canonicalDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function queryChoice<const T extends readonly string[]>(query: Readonly<Record<string, unknown>>, field: string, choices: T): T[number] | null {
  const value = queryText(query, field, 64);
  if (value === null) return null;
  if (!choices.includes(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  return value as T[number];
}
