import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import { keysetResult, queryPage } from '../../../../pipeline/Validation';
import { MEMBER_ACCESS_PORT } from '../../../access/public';
import { BENEFIT_SETTLEMENT_READ_PORT } from '../../../finance/public';
import { benefitAccountReader } from './BenefitAccountReader';

export function benefitReader(context: ModuleContext) {
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  const settlements = context.ports.get(BENEFIT_SETTLEMENT_READ_PORT);
  return {
    readAccounts: benefitAccountReader(context),
    readLedger: async (request: Parameters<ReturnType<typeof benefitAccountReader>>[0], database: Parameters<ReturnType<typeof benefitAccountReader>>[1]) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const member = await members.member(database.transaction, access.membership.id);
      const accounts = await database.query<{ id: string; kind: string; currency: string; finance_account_id: string }>(`select id,kind,currency,finance_account_id from benefit.account where member_id=$1`, [member]);
      const accountByFinance = new Map(accounts.rows.map((account) => [account.finance_account_id, account] as const));
      const entries = await settlements.entries(database.transaction, [...accountByFinance.keys()], { occurredAt: page.sort, entry: page.id }, page.fetch);
      return keysetResult(
        {
          rows: entries.map((entry) => ({ ...entry, account: accountByFinance.get(entry.accountId)!.id, kind: accountByFinance.get(entry.accountId)!.kind, currency: accountByFinance.get(entry.accountId)!.currency })),
          rowCount: entries.length,
        } as never,
        page,
        'occurredAt'
      );
    },
    readPlans: async (request: Parameters<ReturnType<typeof benefitAccountReader>>[0], database: Parameters<ReturnType<typeof benefitAccountReader>>[1]) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select plan.id,plan.scope_id,plan.name,plan.kind,plan.currency,plan.state,plan.version,
        coalesce((select jsonb_agg(jsonb_build_object('version',version.version,'name',version.name,'kind',version.kind,
          'currency',version.currency,'state',version.state,'changedBy',version.changed_by,'changedAt',version.changed_at)
          order by version.version desc) from benefit.planversion version where version.plan_id=plan.id),'[]'::jsonb) versions
        from benefit.plan plan where plan.scope_id=$1 and ($2::text is null or plan.id>$2) order by plan.id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    readBudgets: async (request: Parameters<ReturnType<typeof benefitAccountReader>>[0], database: Parameters<ReturnType<typeof benefitAccountReader>>[1]) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select budget.id,budget.plan_id,plan.name plan_name,budget.period,budget.total_minor::float8 total_minor,
        budget.reserved_minor::float8 reserved_minor,budget.granted_minor::float8 granted_minor,
        (budget.total_minor-budget.reserved_minor-budget.granted_minor)::float8 available_minor,budget.version
        from benefit.budget budget join benefit.plan plan on plan.id=budget.plan_id where plan.scope_id=$1
        and ($2::text is null or budget.id>$2) order by budget.id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    readGrants: async (request: Parameters<ReturnType<typeof benefitAccountReader>>[0], database: Parameters<ReturnType<typeof benefitAccountReader>>[1]) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select batch.id,batch.plan_id,batch.budget_id,batch.state,batch.requested_by,batch.approved_by,
        batch.requested_count,batch.amount_minor,batch.reason,batch.created_at,batch.updated_at,batch.plan_version,batch.effective_at,
        batch.expires_at,batch.timezone,batch.snapshot_hash,batch.pause_reason,plan.name plan_name,budget.period,
        coalesce((select jsonb_object_agg(state,count) from (select state,count(*) count from benefit.grantitem item where item.batch_id=batch.id group by state) status),'{}'::jsonb) item_counts,
        coalesce((select jsonb_agg(jsonb_build_object('sequence',decision.sequence,'decision',decision.decision,'actor',decision.actor_id,'reason',decision.reason,'evidence',decision.evidence,'occurredAt',decision.occurred_at) order by decision.sequence) from benefit.grantdecision decision where decision.batch_id=batch.id),'[]'::jsonb) decisions,
        coalesce((select jsonb_agg(jsonb_build_object('action',action.action,'actor',action.actor_id,'reason',action.reason,'evidence',action.evidence,'occurredAt',action.occurred_at) order by action.occurred_at,action.id) from benefit.action action where action.batch_id=batch.id),'[]'::jsonb) actions
        from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id join benefit.budget budget on budget.id=batch.budget_id
        where plan.scope_id=$1 and ($2::timestamptz is null or (batch.created_at,batch.id)<($2::timestamptz,$3)) order by batch.created_at desc,batch.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
    readLots: async (request: Parameters<ReturnType<typeof benefitAccountReader>>[0], database: Parameters<ReturnType<typeof benefitAccountReader>>[1]) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const result = await database.query(
        `select lot.id,lot.account_id,lot.batch_id,lot.member_id,lot.total_minor,lot.remaining_minor,
        lot.state,lot.effective_at,lot.expires_at,lot.origin,lot.version,account.kind,account.currency,account.scope_id,
        coalesce((select jsonb_agg(jsonb_build_object('id',movement.id,'kind',movement.kind,'amountMinor',movement.amount_minor,
          'referenceType',movement.reference_type,'referenceId',movement.reference_id,'source',movement.source_id,'occurredAt',movement.occurred_at)
          order by movement.occurred_at,movement.id) from benefit.lotmovement movement where movement.lot_id=lot.id),'[]'::jsonb) movements
        from benefit.lot lot join benefit.account account on account.id=lot.account_id where account.scope_id=$1
        and ($2::text is null or lot.id>$2) order by lot.id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
  };
}
