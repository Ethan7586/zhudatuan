import { DomainError } from '../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { GrantPolicy, planState } from './domain/policy/GrantPolicy';
import { actionRecord, cancelUnexecuted, digest, enqueue, instant, memberSnapshot, record } from './BenefitOperationSupport';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { BENEFIT_ACCOUNTING_PORT } from '../finance/public';

const PLAN_STATES = new Set(['draft', 'active', 'paused', 'retired']);
const PLAN_KINDS = new Set(['welfare', 'meal', 'allowance']);
const policy = new GrantPolicy();

export function benefitOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  const finance = context.ports.get(BENEFIT_ACCOUNTING_PORT);
  return new ModuleOperations('benefit', pool, context.service(AUDIT_SINK), {
    'benefit.accounts.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const member = await members.member(database, access.membership.id);
      const result = await database.query(
        `select account.id,account.kind,account.currency,account.status,account.version,
        balance.balance_minor::float8 balance_minor,
        coalesce((select sum(reservation.amount_minor) from benefit.reservation reservation where reservation.account_id=account.id
          and reservation.state='active' and reservation.expires_at>clock_timestamp()),0)::float8 frozen_minor,
        greatest(0,least(balance.balance_minor,coalesce((select sum(lot.remaining_minor) from benefit.lot lot where lot.account_id=account.id
          and lot.state='active' and lot.effective_at<=clock_timestamp() and (lot.expires_at is null or lot.expires_at>clock_timestamp())),0))
          -coalesce((select sum(reservation.amount_minor) from benefit.reservation reservation
          where reservation.account_id=account.id and reservation.state='active' and reservation.expires_at>clock_timestamp()),0))::float8 available_minor,
        coalesce((select jsonb_agg(jsonb_build_object('id',lot.id,'batch',lot.batch_id,'totalMinor',lot.total_minor,
          'remainingMinor',lot.remaining_minor,'state',lot.state,
          'effectiveAt',to_char(lot.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'expiresAt',case when lot.expires_at is null then null else
            to_char(lot.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end)
          order by lot.effective_at,lot.expires_at nulls last,lot.id) from benefit.lot lot where lot.account_id=account.id
          and lot.state in('pending','active')),'[]'::jsonb) lots
        from benefit.account account join benefit.balance balance on balance.account_id=account.id
        where account.member_id=$1 and ($2::text is null or (account.kind,account.id)>($2,$3))
        order by account.kind,account.id limit $4`,
        [member, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'kind');
    },
    'benefit.ledgers.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const member = await members.member(database, access.membership.id);
      const accounts = await database.query<{ id: string; kind: string; currency: string; finance_account_id: string }>(`select id,kind,currency,finance_account_id from benefit.account where member_id=$1`, [member]);
      const accountByFinance = new Map(accounts.rows.map((account) => [account.finance_account_id, account] as const));
      const entries = await finance.benefitLedger(database, [...accountByFinance.keys()], { occurredAt: page.sort, entry: page.id }, page.fetch);
      return keysetResult(
        {
          rows: entries.map((entry) => ({ ...entry, account: accountByFinance.get(entry.account)!.id, kind: accountByFinance.get(entry.account)!.kind, currency: accountByFinance.get(entry.account)!.currency })),
          rowCount: entries.length,
        } as never,
        page,
        'occurredAt'
      );
    },
    'benefit.plans.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select plan.id,plan.scope_id,plan.name,plan.kind,plan.currency,plan.state,plan.version,
        coalesce((select jsonb_agg(jsonb_build_object('version',version.version,'name',version.name,'kind',version.kind,
          'currency',version.currency,'state',version.state,'changedBy',version.changed_by,'changedAt',version.changed_at)
          order by version.version desc) from benefit.planversion version where version.plan_id=plan.id),'[]'::jsonb) versions
        from benefit.plan plan where plan.scope_id=$1 and ($2::text is null or plan.id>$2)
        order by plan.id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    'benefit.plans.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const kind = textField(body, 'kind', 16);
      const state = textField(body, 'state', 16);
      const currency = textField(body, 'currency', 3).toUpperCase();
      if (!PLAN_KINDS.has(kind)) throw new Error('BENEFIT_PLAN_KIND_INVALID');
      if (!PLAN_STATES.has(state)) throw new Error('BENEFIT_PLAN_STATE_INVALID');
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error('BENEFIT_CURRENCY_INVALID');
      const current = await database.query<{ state: string }>('select state from benefit.plan where id=$1 and scope_id=$2 for update', [request.input.path.planid!, access.scope.id]);
      policy.assertPlanTransition(current.rows[0] ? planState(current.rows[0].state) : null, planState(state));
      const result = await database.query<{ id: string; name: string; kind: string; currency: string; state: string; version: number }>(
        `insert into benefit.plan(id,scope_id,name,kind,currency,state,version) values($1,$2,$3,$4,$5,$6,0)
        on conflict(id) do update set name=excluded.name,kind=excluded.kind,currency=excluded.currency,state=excluded.state,
          version=benefit.plan.version+1 where benefit.plan.scope_id=$2 and ($7::bigint is null or benefit.plan.version=$7)
        returning id,name,kind,currency,state,version::integer`,
        [request.input.path.planid!, access.scope.id, textField(body, 'name'), kind, currency, state, request.input.expectedVersion ?? null]
      );
      const changed = result.rows[0];
      if (!changed) throw new DomainError('VERSION_CONFLICT');
      await database.query(
        `insert into benefit.planversion(plan_id,version,name,kind,currency,state,changed_by,changed_at)
        values($1,$2,$3,$4,$5,$6,$7,clock_timestamp())`,
        [changed.id, changed.version, changed.name, changed.kind, changed.currency, changed.state, access.actor.id]
      );
      return rowResult(result);
    },
    'benefit.budgets.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
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
    'benefit.budgets.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const period = textField(body, 'period', 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('BENEFIT_BUDGET_PERIOD_INVALID');
      const total = integerField(body, 'totalMinor');
      const result = await database.query(
        `insert into benefit.budget(id,plan_id,period,total_minor,granted_minor,reserved_minor,version)
        select $1,plan.id,$2,$3,0,0,0 from benefit.plan plan where plan.id=$4 and plan.scope_id=$5
        on conflict(id) do update set period=excluded.period,total_minor=excluded.total_minor,version=benefit.budget.version+1
        where benefit.budget.plan_id=excluded.plan_id and benefit.budget.reserved_minor+benefit.budget.granted_minor<=excluded.total_minor
          and ($6::bigint is null or benefit.budget.version=$6) returning *`,
        [request.input.path.budgetid!, period, total, body.plan, access.scope.id, request.input.expectedVersion ?? null]
      );
      if (!result.rows[0]) throw new Error('BENEFIT_BUDGET_CONFLICT');
      return rowResult(result);
    },
    'benefit.grants.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const members = memberSnapshot(body.members);
      const amount = integerField(body, 'amountMinor', 1);
      const effective = instant(body.effectiveAt ?? new Date().toISOString(), 'effectiveAt');
      const expires = instant(body.expiresAt, 'expiresAt');
      const timezone = textField(body, 'timezone', 64);
      policy.assertValidity(effective, expires, timezone);
      const plan = await database.query<{ version: number }>(
        `select plan.version::integer from benefit.plan plan
        join benefit.budget budget on budget.plan_id=plan.id where plan.id=$1 and plan.scope_id=$2 and plan.state='active' and budget.id=$3
        and budget.total_minor-budget.reserved_minor-budget.granted_minor >= $4 for update of plan,budget`,
        [body.plan, access.scope.id, body.budget, members.length * amount]
      );
      if (!plan.rows[0]) throw new Error('BENEFIT_PLAN_OR_BUDGET_UNAVAILABLE');
      const id = `grantbatch:${randomUUID()}`;
      const snapshot = members.map((member) => `${member}:${amount}`).join(',');
      const result = await database.query(
        `insert into benefit.grantbatch(id,plan_id,budget_id,state,requested_by,requested_count,
        amount_minor,reason,created_at,updated_at,plan_version,effective_at,expires_at,timezone,snapshot_hash)
        values($1,$2,$3,'submitted',$4,$5,$6,$7,clock_timestamp(),clock_timestamp(),$8,$9,$10,$11,$12) returning *`,
        [id, body.plan, body.budget, access.actor.id, members.length, amount, textField(body, 'reason', 1000), plan.rows[0].version, effective.toISOString(), expires.toISOString(), timezone, digest(snapshot)]
      );
      await database.query(
        `insert into benefit.grantitem(batch_id,member_id,amount_minor,state)
        select $1,member,$2,'queued' from unnest($3::text[]) member`,
        [id, amount, members]
      );
      return rowResult(result, 201);
    },
    'benefit.grants.decide': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
      if (!decision) throw new Error('BENEFIT_DECISION_INVALID');
      const batch = await database.query<{ id: string; budget_id: string; requested_count: number; amount_minor: number; scope_id: string; requested_by: string }>(
        `select batch.id,batch.budget_id,batch.requested_count,batch.amount_minor::float8 amount_minor,plan.scope_id,batch.requested_by
        from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id where batch.id=$1 and plan.scope_id=$2
        and batch.state='submitted' and batch.requested_by<>$3 for update of batch`,
        [request.input.path.batchid!, access.scope.id, access.actor.id]
      );
      const selected = batch.rows[0];
      if (!selected) throw new Error('BENEFIT_DECISION_CONFLICT_OR_SEPARATION');
      policy.assertFourEyes(selected.requested_by, access.actor.id);
      const total = selected.requested_count * selected.amount_minor;
      if (decision === 'approved') {
        const reserved = await database.query(
          `update benefit.budget set reserved_minor=reserved_minor+$2,version=version+1 where id=$1
          and total_minor-reserved_minor-granted_minor >= $2 returning id`,
          [selected.budget_id, total]
        );
        if (!reserved.rows[0]) throw new Error('BENEFIT_BUDGET_INSUFFICIENT');
      }
      const result = await database.query(
        `update benefit.grantbatch set state=$2,approved_by=case when $2='approved' then $3 else null end,
        updated_at=clock_timestamp() where id=$1 returning *`,
        [selected.id, decision, access.actor.id]
      );
      await database.query(
        `insert into benefit.grantdecision(batch_id,sequence,decision,actor_id,membership_id,reason,evidence,trace_id,occurred_at)
        select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,$6::jsonb,$7,clock_timestamp() from benefit.grantdecision where batch_id=$1`,
        [selected.id, decision, access.actor.id, access.membership.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), access.trace]
      );
      if (decision === 'approved') await enqueue(database, selected.scope_id, { kind: 'benefitgrant', batch: selected.id }, `job:${selected.id}`);
      return rowResult(result);
    },
    'benefit.grants.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select batch.id,batch.plan_id,batch.budget_id,batch.state,batch.requested_by,batch.approved_by,
        batch.requested_count,batch.amount_minor,batch.reason,batch.created_at,batch.updated_at,batch.plan_version,batch.effective_at,
        batch.expires_at,batch.timezone,batch.snapshot_hash,batch.pause_reason,plan.name plan_name,budget.period,
        coalesce((select jsonb_object_agg(state,count) from (select state,count(*) count from benefit.grantitem item
          where item.batch_id=batch.id group by state) status),'{}'::jsonb) item_counts,
        coalesce((select jsonb_agg(jsonb_build_object('sequence',decision.sequence,'decision',decision.decision,'actor',decision.actor_id,
          'reason',decision.reason,'evidence',decision.evidence,'occurredAt',decision.occurred_at) order by decision.sequence)
          from benefit.grantdecision decision where decision.batch_id=batch.id),'[]'::jsonb) decisions,
        coalesce((select jsonb_agg(jsonb_build_object('action',action.action,'actor',action.actor_id,'reason',action.reason,
          'evidence',action.evidence,'occurredAt',action.occurred_at) order by action.occurred_at,action.id)
          from benefit.action action where action.batch_id=batch.id),'[]'::jsonb) actions
        from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id join benefit.budget budget on budget.id=batch.budget_id
        where plan.scope_id=$1 and ($2::timestamptz is null or (batch.created_at,batch.id)<($2::timestamptz,$3))
        order by batch.created_at desc,batch.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
    'benefit.grants.control': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const action = textField(body, 'action', 16);
      const reason = textField(body, 'reason', 1000);
      const batchid = request.input.path.batchid!;
      const current = await database.query<{ state: string }>(
        `select batch.state from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id
        where batch.id=$1 and plan.scope_id=$2 for update of batch`,
        [batchid, access.scope.id]
      );
      if (!current.rows[0] || !['pause', 'resume', 'cancel'].includes(action)) throw new Error('BENEFIT_CONTROL_ACTION_INVALID');
      policy.assertControl(current.rows[0].state as Parameters<GrantPolicy['assertControl']>[0], action as Parameters<GrantPolicy['assertControl']>[1]);
      let result;
      if (action === 'pause')
        result = await database.query(
          `update benefit.grantbatch batch set state='paused',pause_reason=$3,updated_at=clock_timestamp()
        from benefit.plan plan where batch.id=$1 and plan.id=batch.plan_id and plan.scope_id=$2 and batch.state in('approved','running','scheduled') returning batch.*`,
          [batchid, access.scope.id, reason]
        );
      else if (action === 'resume') {
        result = await database.query(
          `update benefit.grantbatch batch set state=case when exists(select 1 from benefit.grantitem item where item.batch_id=batch.id
          and item.state='queued') then 'approved' else 'scheduled' end,pause_reason=null,updated_at=clock_timestamp() from benefit.plan plan
          where batch.id=$1 and plan.id=batch.plan_id and plan.scope_id=$2 and batch.state='paused' returning batch.*`,
          [batchid, access.scope.id]
        );
        if (result.rows[0]) await enqueue(database, access.scope.id, { kind: 'benefitgrant', batch: batchid });
      } else if (action === 'cancel') {
        result = await database.query<{ id: string; budget_id: string }>(
          `update benefit.grantbatch batch set state='cancelled',pause_reason=$3,updated_at=clock_timestamp()
          from benefit.plan plan where batch.id=$1 and plan.id=batch.plan_id and plan.scope_id=$2
          and batch.state in('approved','paused','scheduled') returning batch.id,batch.budget_id`,
          [batchid, access.scope.id, reason]
        );
        if (result.rows[0]) await cancelUnexecuted(database, batchid, result.rows[0].budget_id);
      } else throw new Error('BENEFIT_CONTROL_ACTION_INVALID');
      if (!result.rows[0]) throw new Error('BENEFIT_CONTROL_STATE_CONFLICT');
      await actionRecord(database, batchid, action, access.actor.id, reason, record(body.evidence));
      return rowResult(result);
    },
    'benefit.grants.revoke': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const batchid = request.input.path.batchid!;
      const result = await database.query<{ requested_by: string }>(
        `update benefit.grantbatch batch set state='revoking',updated_at=clock_timestamp()
        from benefit.plan plan where batch.id=$1 and plan.id=batch.plan_id and plan.scope_id=$2
        and batch.state in('completed','scheduled','paused','failed') and batch.requested_by<>$3 returning batch.*`,
        [batchid, access.scope.id, access.actor.id]
      );
      if (!result.rows[0]) throw new Error('BENEFIT_REVOKE_CONFLICT_OR_SEPARATION');
      policy.assertFourEyes(result.rows[0].requested_by, access.actor.id);
      await database.query(`update benefit.grantitem set state='revoking' where batch_id=$1 and state in('queued','scheduled','granted')`, [batchid]);
      await actionRecord(database, batchid, 'revoke', access.actor.id, textField(body, 'reason', 1000), record(body.evidence));
      await enqueue(database, access.scope.id, { kind: 'benefitrevoke', batch: batchid });
      return rowResult(result, 202);
    },
    'benefit.lots.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
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
  });
}
