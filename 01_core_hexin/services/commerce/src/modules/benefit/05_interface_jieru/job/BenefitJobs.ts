import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { FinancePort } from '../../../finance';

const finance = new FinancePort();

interface Batch {
  readonly id: string;
  readonly scope_id: string;
  readonly kind: string;
  readonly currency: string;
  readonly budget_id: string;
  readonly effective_at: string;
  readonly expires_at: string;
  readonly state: string;
}

interface GrantItem { readonly member_id: string; readonly amount_minor: number }

export class BenefitJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly kind: 'benefitgrant' | 'benefitexpiry' = 'benefitgrant') {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    if (this.kind === 'benefitexpiry') return this.expire();
    const payload = object(job.payload);
    const batch = text(payload.batch, 'BENEFIT_BATCH_REQUIRED');
    return payload.kind === 'benefitrevoke' ? this.revoke(batch) : payload.kind === 'benefitgrant' ? this.grant(batch)
      : Promise.reject(new Error('BENEFIT_JOB_SUBTYPE_INVALID'));
  }

  private async grant(batchid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const selected = await lockBatch(client, batchid);
      if (!selected || ['paused', 'cancelled', 'completed', 'revoking', 'revoked', 'failed', 'rejected'].includes(selected.state)) {
        await client.query('commit');
        return;
      }
      if (!['approved', 'running'].includes(selected.state)) throw new Error('BENEFIT_BATCH_NOT_APPROVED');
      await client.query(`update benefit.grantbatch set state='running',updated_at=clock_timestamp() where id=$1`, [batchid]);
      const items = await client.query<GrantItem>(`select member_id,amount_minor::float8 amount_minor from benefit.grantitem
        where batch_id=$1 and state='queued' order by member_id for update skip locked limit 500`, [batchid]);
      for (const item of items.rows) await this.grantItem(client, selected, item);
      const counts = await itemCounts(client, batchid);
      if (counts.queued > 0) await enqueue(client, selected.scope_id, { kind: 'benefitgrant', batch: batchid });
      await client.query(`update benefit.grantbatch set state=case when $2>0 then 'running' when $3>0 then 'scheduled' else 'completed' end,
        updated_at=clock_timestamp() where id=$1 and state='running'`, [batchid, counts.queued, counts.scheduled]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async grantItem(client: PoolClient, batch: Batch, item: GrantItem): Promise<void> {
    const member = await client.query(`select 1 from member.profile where id=$1 and status='active'`, [item.member_id]);
    if (!member.rows[0]) {
      await client.query(`update benefit.grantitem set state='skipped',error_code='MEMBER_INACTIVE' where batch_id=$1 and member_id=$2 and state='queued'`,
      [batch.id, item.member_id]);
      await releaseReserved(client, batch.budget_id, item.amount_minor);
      return;
    }
    const accountid = `benefit:${digest(`${item.member_id}:${batch.scope_id}:${batch.kind}:${batch.currency}`)}`;
    const financeid = await finance.account(client, batch.scope_id, `benefit.${accountid}`, batch.currency, 'liability');
    await client.query(`insert into benefit.account(id,member_id,scope_id,kind,currency,status,version,finance_account_id)
      values($1,$2,$3,$4,$5,'active',0,$6) on conflict(member_id,scope_id,kind,currency) do nothing`,
    [accountid, item.member_id, batch.scope_id, batch.kind, batch.currency, financeid]);
    const account = await client.query<{ id: string }>(`select id from benefit.account where member_id=$1 and scope_id=$2 and kind=$3 and currency=$4 for update`,
    [item.member_id, batch.scope_id, batch.kind, batch.currency]);
    const resolved = account.rows[0]?.id;
    if (!resolved) throw new Error('BENEFIT_ACCOUNT_CREATE_FAILED');
    const due = new Date(batch.effective_at).getTime() <= Date.now();
    const lotid = `lot:${digest(`${resolved}:${batch.id}`)}`;
    await client.query(`insert into benefit.lot(id,account_id,batch_id,member_id,total_minor,remaining_minor,state,effective_at,expires_at,version)
      values($1,$2,$3,$4,$5,$5,$6,$7,$8,0) on conflict(id) do nothing`,
    [lotid, resolved, batch.id, item.member_id, item.amount_minor, due ? 'active' : 'pending', batch.effective_at, batch.expires_at]);
    if (!due) {
      await client.query(`update benefit.grantitem set state='scheduled',error_code=null where batch_id=$1 and member_id=$2 and state='queued'`,
      [batch.id, item.member_id]);
      return;
    }
    await post(client, batch.scope_id, 'benefit.grant', `${batch.id}:${item.member_id}`, batch.currency, 'Benefit grant',
      'benefit.expense', 'expense', `benefit.${resolved}`, 'liability', item.amount_minor, batch.effective_at);
    await client.query(`insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
      values($1,$2,'grant',$3,'grantbatch',$4,$5) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
    [`movement:${digest(`${lotid}:grant`)}`, lotid, item.amount_minor, batch.id, batch.effective_at]);
    const changed = await client.query(`update benefit.grantitem set state='granted',error_code=null where batch_id=$1 and member_id=$2 and state='queued' returning member_id`,
    [batch.id, item.member_id]);
    if (changed.rows[0]) {
      await moveReservedToGranted(client, batch.budget_id, item.amount_minor);
      await event(client, 'benefit.granted', 'account', resolved, batch.scope_id,
        { batch: batch.id, account: resolved, member: item.member_id, amountMinor: item.amount_minor, currency: batch.currency, kind: batch.kind },
        `benefit:grant:${batch.id}:${item.member_id}`);
    }
  }

  private async revoke(batchid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const batch = await lockBatch(client, batchid);
      if (!batch || batch.state === 'revoked') { await client.query('commit'); return; }
      if (batch.state !== 'revoking') throw new Error('BENEFIT_BATCH_NOT_REVOKING');
      const items = await client.query<GrantItem>(`select member_id,amount_minor::float8 amount_minor from benefit.grantitem
        where batch_id=$1 and state='revoking' order by member_id for update skip locked limit 500`, [batchid]);
      for (const item of items.rows) await this.revokeItem(client, batch, item);
      const remaining = await client.query<{ count: number }>(`select count(*)::integer count from benefit.grantitem where batch_id=$1 and state='revoking'`, [batchid]);
      if (remaining.rows[0]!.count > 0) await enqueue(client, batch.scope_id, { kind: 'benefitrevoke', batch: batchid });
      else {
        await client.query(`update benefit.grantbatch set state='revoked',updated_at=clock_timestamp() where id=$1 and state='revoking'`, [batchid]);
        await event(client, 'benefit.revoked', 'grantbatch', batchid, batch.scope_id, { batch: batchid }, `benefit:revoke:${batchid}`);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async revokeItem(client: PoolClient, batch: Batch, item: GrantItem): Promise<void> {
    const lot = await client.query<{ id: string; account_id: string; remaining_minor: number; state: string }>(`select id,account_id,
      remaining_minor::float8 remaining_minor,state from benefit.lot where batch_id=$1 and member_id=$2 for update`, [batch.id, item.member_id]);
    const selected = lot.rows[0];
    if (!selected) {
      await releaseReserved(client, batch.budget_id, item.amount_minor);
      await client.query(`update benefit.grantitem set state='revoked',error_code=null where batch_id=$1 and member_id=$2 and state='revoking'`, [batch.id, item.member_id]);
      return;
    }
    if (selected.state === 'pending') {
      await client.query(`update benefit.lot set state='revoked',remaining_minor=0,version=version+1 where id=$1`, [selected.id]);
      await releaseReserved(client, batch.budget_id, item.amount_minor);
    } else if (selected.remaining_minor > 0 && !['expired', 'revoked'].includes(selected.state)) {
      await post(client, batch.scope_id, 'benefit.revoke', `${batch.id}:${item.member_id}`, batch.currency, 'Benefit revoke',
        `benefit.${selected.account_id}`, 'liability', 'benefit.recovery', 'income', selected.remaining_minor);
      await client.query(`update benefit.lot set state='revoked',remaining_minor=0,version=version+1 where id=$1`, [selected.id]);
      await client.query(`update benefit.budget set granted_minor=granted_minor-$2,version=version+1 where id=$1 and granted_minor>=$2`,
      [batch.budget_id, selected.remaining_minor]);
    }
    if (selected.remaining_minor > 0) await client.query(`insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
      values($1,$2,'revoke',$3,'grantbatch',$4,clock_timestamp()) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
    [`movement:${digest(`${selected.id}:revoke:${batch.id}`)}`, selected.id, selected.remaining_minor, batch.id]);
    await client.query(`update benefit.grantitem set state='revoked',error_code=null where batch_id=$1 and member_id=$2 and state='revoking'`, [batch.id, item.member_id]);
  }

  private async expire(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await this.activateDue(client);
      await this.remindUpcoming(client);
      const lots = await client.query<{ id: string; account_id: string; batch_id: string; member_id: string; remaining_minor: number;
        scope_id: string; currency: string; budget_id: string }>(`select lot.id,lot.account_id,lot.batch_id,lot.member_id,
        lot.remaining_minor::float8 remaining_minor,account.scope_id,account.currency,batch.budget_id from benefit.lot lot
        join benefit.account account on account.id=lot.account_id join benefit.grantbatch batch on batch.id=lot.batch_id
        where lot.state='active' and lot.expires_at<=clock_timestamp() and lot.remaining_minor>0
          and not exists(select 1 from benefit.reservation reservation where reservation.account_id=lot.account_id
            and reservation.state='active' and reservation.expires_at>clock_timestamp())
        order by lot.expires_at,lot.id for update of lot,account skip locked limit 500`);
      for (const lot of lots.rows) {
        await post(client, lot.scope_id, 'benefit.expire', lot.id, lot.currency, 'Benefit expiry',
          `benefit.${lot.account_id}`, 'liability', 'benefit.expiry', 'income', lot.remaining_minor);
        await client.query(`update benefit.lot set state='expired',remaining_minor=0,version=version+1 where id=$1`, [lot.id]);
        await client.query(`insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
          values($1,$2,'expire',$3,'lot',$2,clock_timestamp()) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
        [`movement:${digest(`${lot.id}:expire`)}`, lot.id, lot.remaining_minor]);
        await client.query(`update benefit.budget set granted_minor=granted_minor-$2,version=version+1 where id=$1 and granted_minor>=$2`,
        [lot.budget_id, lot.remaining_minor]);
        await client.query(`update benefit.grantitem set state='expired' where batch_id=$1 and member_id=$2 and state='granted'`, [lot.batch_id, lot.member_id]);
        await event(client, 'benefit.expired', 'lot', lot.id, lot.scope_id,
          { lot: lot.id, batch: lot.batch_id, account: lot.account_id, member: lot.member_id, amountMinor: lot.remaining_minor, currency: lot.currency },
          `benefit:expire:${lot.id}`);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async activateDue(client: PoolClient): Promise<void> {
    const lots = await client.query<{ id: string; account_id: string; batch_id: string; member_id: string; total_minor: number; effective_at: string;
      scope_id: string; currency: string; kind: string; budget_id: string }>(`select lot.id,lot.account_id,lot.batch_id,lot.member_id,
      lot.total_minor::float8 total_minor,lot.effective_at,account.scope_id,account.currency,account.kind,batch.budget_id from benefit.lot lot
      join benefit.account account on account.id=lot.account_id join benefit.grantbatch batch on batch.id=lot.batch_id
      where lot.state='pending' and lot.effective_at<=clock_timestamp() and batch.state='scheduled'
      order by lot.effective_at,lot.id for update of lot skip locked limit 500`);
    for (const lot of lots.rows) {
      await post(client, lot.scope_id, 'benefit.grant', `${lot.batch_id}:${lot.member_id}`, lot.currency, 'Scheduled benefit grant',
        'benefit.expense', 'expense', `benefit.${lot.account_id}`, 'liability', lot.total_minor, lot.effective_at);
      await client.query(`update benefit.lot set state='active',version=version+1 where id=$1 and state='pending'`, [lot.id]);
      await client.query(`insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
        values($1,$2,'grant',$3,'grantbatch',$4,$5) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
      [`movement:${digest(`${lot.id}:grant`)}`, lot.id, lot.total_minor, lot.batch_id, lot.effective_at]);
      await client.query(`update benefit.grantitem set state='granted',error_code=null where batch_id=$1 and member_id=$2 and state='scheduled'`, [lot.batch_id, lot.member_id]);
      await moveReservedToGranted(client, lot.budget_id, lot.total_minor);
      await event(client, 'benefit.granted', 'account', lot.account_id, lot.scope_id,
        { batch: lot.batch_id, account: lot.account_id, member: lot.member_id, amountMinor: lot.total_minor, currency: lot.currency, kind: lot.kind },
        `benefit:grant:${lot.batch_id}:${lot.member_id}`);
      await client.query(`update benefit.grantbatch set state='completed',updated_at=clock_timestamp() where id=$1 and state='scheduled'
        and not exists(select 1 from benefit.grantitem where batch_id=$1 and state='scheduled')`, [lot.batch_id]);
    }
  }

  private async remindUpcoming(client: PoolClient): Promise<void> {
    const lots = await client.query<{ id: string; account_id: string; batch_id: string; member_id: string; remaining_minor: number;
      expires_at: string; scope_id: string; currency: string }>(`select lot.id,lot.account_id,lot.batch_id,lot.member_id,
      lot.remaining_minor::float8 remaining_minor,lot.expires_at,account.scope_id,account.currency from benefit.lot lot
      join benefit.account account on account.id=lot.account_id where lot.state='active' and lot.remaining_minor>0
      and lot.expires_at>clock_timestamp() and lot.expires_at<=clock_timestamp()+interval '3 days'
      and not exists(select 1 from benefit.reminder reminder where reminder.lot_id=lot.id and reminder.kind='expiry')
      order by lot.expires_at,lot.id for update of lot skip locked limit 500`);
    for (const lot of lots.rows) {
      const inserted = await client.query(`insert into benefit.reminder(id,lot_id,kind,scheduled_at,sent_at)
        values($1,$2,'expiry',clock_timestamp(),clock_timestamp()) on conflict(lot_id,kind) do nothing returning id`,
      [`reminder:${digest(`${lot.id}:expiry`)}`, lot.id]);
      if (inserted.rows[0]) await event(client, 'benefit.expiry.reminded', 'lot', lot.id, lot.scope_id,
        { lot: lot.id, batch: lot.batch_id, account: lot.account_id, member: lot.member_id, remainingMinor: lot.remaining_minor,
          currency: lot.currency, expiresAt: lot.expires_at }, `benefit:expiry:reminder:${lot.id}`);
    }
  }
}

async function lockBatch(client: PoolClient, batch: string): Promise<Batch | undefined> {
  const result = await client.query<Batch>(`select batch.id,plan.scope_id,version.kind,version.currency,batch.budget_id,batch.effective_at,
    batch.expires_at,batch.state from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id
    join benefit.planversion version on version.plan_id=batch.plan_id and version.version=batch.plan_version where batch.id=$1 for update of batch`, [batch]);
  return result.rows[0];
}

async function itemCounts(client: PoolClient, batch: string) {
  const result = await client.query<{ queued: number; scheduled: number }>(`select count(*) filter(where state='queued')::integer queued,
    count(*) filter(where state='scheduled')::integer scheduled from benefit.grantitem where batch_id=$1`, [batch]);
  return result.rows[0]!;
}

async function releaseReserved(client: PoolClient, budget: string, amount: number) {
  const changed = await client.query(`update benefit.budget set reserved_minor=reserved_minor-$2,version=version+1
    where id=$1 and reserved_minor>=$2 returning id`, [budget, amount]);
  if (!changed.rows[0]) throw new Error('BENEFIT_RESERVED_BUDGET_INTEGRITY_FAILED');
}

async function moveReservedToGranted(client: PoolClient, budget: string, amount: number) {
  const changed = await client.query(`update benefit.budget set reserved_minor=reserved_minor-$2,granted_minor=granted_minor+$2,version=version+1
    where id=$1 and reserved_minor>=$2 returning id`, [budget, amount]);
  if (!changed.rows[0]) throw new Error('BENEFIT_BUDGET_TRANSITION_FAILED');
}

async function post(client: PoolClient, scope: string, referenceType: string, referenceId: string, currency: string, description: string,
  debitCode: string, debitKind: string, creditCode: string, creditKind: string, amount: number, occurred?: string) {
  await finance.post(client, { scope, referenceType, referenceId, currency, description,
    debit: { code: debitCode, kind: financeKind(debitKind) }, credit: { code: creditCode, kind: financeKind(creditKind) },
    amountMinor: amount, ...(occurred === undefined ? {} : { occurredAt: occurred }) });
}

async function event(client: PoolClient, type: string, aggregateType: string, aggregate: string, scope: string, payload: unknown, key: string) {
  await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values($1,$2,1,$3,$4,$5,$6::jsonb,$1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
  [`event:${digest(key)}`, type, aggregateType, aggregate, scope, JSON.stringify(payload)]);
}

async function enqueue(client: PoolClient, scope: string, payload: unknown) {
  await client.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'benefitgrant','benefit',$2,$3::jsonb,'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
  [`job:${randomUUID()}`, scope, JSON.stringify(payload)]);
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function financeKind(value: string): 'asset' | 'liability' | 'income' | 'expense' {
  if (!['asset', 'liability', 'income', 'expense'].includes(value)) throw new Error('FINANCE_ACCOUNT_KIND_INVALID');
  return value as 'asset' | 'liability' | 'income' | 'expense';
}
function object(value: unknown): Record<string, unknown> { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
