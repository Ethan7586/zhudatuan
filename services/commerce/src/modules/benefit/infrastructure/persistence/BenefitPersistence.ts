import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { rowResult } from '../../../../adapter/database/DatabaseResult';

import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { GrantPolicy, planState } from '../../domain/policy/GrantPolicy';
import { actionRecord, cancelUnexecuted, digest, enqueue, instant, memberSnapshot, record } from './BenefitPersistenceActions';
import { benefitReader } from './BenefitReader';

const PLAN_STATES = new Set(['draft', 'active', 'paused', 'retired']);
const PLAN_KINDS = new Set(['welfare', 'meal', 'allowance']);
const policy = new GrantPolicy();

export interface BenefitPersistence {
  readonly readAccounts: BenefitAction;
  readonly readLedger: BenefitAction;
  readonly readPlans: BenefitAction;
  readonly managePlan: BenefitAction;
  readonly readBudgets: BenefitAction;
  readonly manageBudget: BenefitAction;
  readonly createGrant: BenefitAction;
  readonly decideGrant: BenefitAction;
  readonly readGrants: BenefitAction;
  readonly controlGrant: BenefitAction;
  readonly revokeGrant: BenefitAction;
  readonly readLots: BenefitAction;
}

type BenefitAction = (request: OperationRequest, database: SqlExecutor) => Promise<OperationResult>;

export function benefitPersistence(context: ModuleContext): BenefitPersistence {
  return {
    ...benefitReader(context),
    managePlan: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
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
    manageBudget: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
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
    createGrant: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
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
    decideGrant: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
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
    controlGrant: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
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
    revokeGrant: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
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
  };
}
