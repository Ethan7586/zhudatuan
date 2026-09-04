import { randomBytes, randomUUID } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { VoucherPolicy, voucherState } from '../../02_domain_yewu/policy/VoucherPolicy';
import { FinancePort } from '../../../finance';

export class VoucherJobProcessor implements JobProcessor {
  private readonly policy = new VoucherPolicy();
  private readonly finance = new FinancePort();
  constructor(private readonly pool: DatabasePool, private readonly kms: KmsClient, private readonly kind: 'voucherissue' | 'voucherexpiry' | 'voucherstatus') {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    if (this.kind === 'voucherexpiry') return this.expire();
    const batch = identifier(job.payload, 'batch', 'VOUCHER_BATCH_REQUIRED');
    return this.kind === 'voucherstatus' ? this.status(batch) : this.issue(batch);
  }

  private async issue(batchid: string): Promise<void> {
    const reserved = await this.pool.connect();
    let values: readonly { id: string; code: string; program: string; version: number; value: number; days: number }[];
    let scope: string;
    try {
      await reserved.query('begin');
      const batch = await reserved.query<{ program_id: string; program_version: number; cardpool_id: string; requested_count: number; issued_count: number; prefix: string;
        next_sequence: number; scope_id: string; value_minor: number; default_valid_days: number; mode: string }>(`select batch.program_id,
        batch.program_version::integer,batch.cardpool_id,batch.requested_count,batch.issued_count,pool.code_prefix prefix,pool.next_sequence::float8 next_sequence,
        program.scope_id,pool.mode,version.value_minor::float8 value_minor,version.default_valid_days from voucher.issuebatch batch
        join voucher.program program on program.id=batch.program_id join voucher.programversion version on version.program_id=batch.program_id and version.version=batch.program_version
        join voucher.cardpool pool on pool.id=batch.cardpool_id
        where batch.id=$1 and batch.state='issuing' and pool.status='ready' for update of batch,pool`, [batchid]);
      const selected = batch.rows[0];
      if (!selected) throw new Error('VOUCHER_ISSUE_BATCH_NOT_RUNNABLE');
      scope = selected.scope_id;
      if (selected.mode === 'imported') {
        await this.issueImported(reserved, batchid, selected);
        await reserved.query('commit');
        return;
      }
      const count = Math.min(500, selected.requested_count-selected.issued_count);
      if (count <= 0) throw new Error('VOUCHER_ISSUE_BATCH_COMPLETE');
      values = Array.from({ length: count }, (_, index) => {
        const sequence = selected.next_sequence+index;
        return { id: `voucher:${randomUUID()}`, code: `${selected.prefix}${String(sequence).padStart(12, '0')}${randomBytes(6).toString('hex').toUpperCase()}`,
          program: selected.program_id, version: selected.program_version, value: selected.value_minor, days: selected.default_valid_days };
      });
      await reserved.query(`update voucher.cardpool set next_sequence=next_sequence+$2,version=version+1 where id=$1`, [selected.cardpool_id, count]);
      await reserved.query('commit');
    } catch (cause) { await reserved.query('rollback'); throw cause; } finally { reserved.release(); }

    const envelopes = await mapParallel(values, 16, async (item) => ({ item,
      envelope: await this.kms.encrypt('voucher/code', item.code, { voucher: item.id, batch: batchid }) }));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query(`select 1 from voucher.issuebatch where id=$1 and state='issuing' for update`, [batchid]);
      if (!locked.rows[0]) throw new Error('VOUCHER_ISSUE_BATCH_NOT_RUNNABLE');
      for (const { item, envelope } of envelopes) await client.query(`insert into voucher.voucher(id,program_id,program_version,batch_id,code_ciphertext,
        code_fingerprint,code_key_version,initial_minor,remaining_minor,state,expires_at,version)
        values($1,$2,$3,$4,$5,$6,$7,$8,$8,'created',clock_timestamp()+make_interval(days=>$9),0)`,
      [item.id, item.program, item.version, batchid, envelope.ciphertext, envelope.fingerprint, envelope.keyVersion, item.value, item.days]);
      for (const { item } of envelopes) await client.query(`insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        values($1,1,null,'created','issuebatch','system',clock_timestamp())`, [item.id]);
      await this.completeChunk(client, batchid, scope!, envelopes.length);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async issueImported(database: import('pg').PoolClient, batchid: string, selected: Readonly<{ cardpool_id: string; program_id: string;
    program_version: number; requested_count: number; issued_count: number; value_minor: number; default_valid_days: number; scope_id: string }>): Promise<void> {
    const count = Math.min(500, selected.requested_count-selected.issued_count);
    if (count <= 0) throw new Error('VOUCHER_ISSUE_BATCH_COMPLETE');
    const cards = await database.query<{ id: string; code_ciphertext: string; code_fingerprint: string; code_key_version: string }>(`select card.id,
      card.code_ciphertext,card.code_fingerprint,card.code_key_version from voucher.card card where card.cardpool_id=$1 and card.state='available'
      order by card.id for update skip locked limit $2`, [selected.cardpool_id, count]);
    if (cards.rows.length !== count) throw new Error('VOUCHER_CARD_LIBRARY_INSUFFICIENT');
    for (const card of cards.rows) {
      await database.query(`update voucher.card set state='allocated',allocated_batch_id=$2,version=version+1 where id=$1 and state='available'`, [card.id, batchid]);
      await database.query(`insert into voucher.voucher(id,program_id,program_version,batch_id,card_id,code_ciphertext,code_fingerprint,code_key_version,
        initial_minor,remaining_minor,state,expires_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,'created',
        clock_timestamp()+make_interval(days=>$10),0)`, [`voucher:${card.id}`, selected.program_id, selected.program_version, batchid, card.id, card.code_ciphertext,
        card.code_fingerprint, card.code_key_version, selected.value_minor, selected.default_valid_days]);
      await database.query(`insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        values($1,1,null,'created','issuebatch','system',clock_timestamp())`, [`voucher:${card.id}`]);
    }
    const completed = await this.completeChunk(database, batchid, selected.scope_id, count);
    if (completed) await database.query(`update voucher.cardpool set status=case when exists(select 1 from voucher.card
      where cardpool_id=$1 and state='available') then 'ready' else 'depleted' end,version=version+1 where id=$1`, [selected.cardpool_id]);
  }

  private async completeChunk(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<import('pg').QueryResult> }>, batchid: string,
    scope: string, count: number): Promise<boolean> {
    const updated = await database.query(`update voucher.issuebatch set issued_count=issued_count+$2,
      state=case when issued_count+$2=requested_count then 'completed' else 'issuing' end
      where id=$1 and issued_count+$2<=requested_count returning issued_count::integer,requested_count`, [batchid, count]);
    const batch = updated.rows[0] as { issued_count: number; requested_count: number } | undefined;
    if (!batch) throw new Error('VOUCHER_ISSUE_COUNT_CONFLICT');
    if (batch.issued_count < batch.requested_count) {
      await enqueue(database, 'voucherissue', scope, { batch: batchid });
      return false;
    }
    const accounting = await database.query(`select batch.program_id,coalesce(sum(voucher.initial_minor),0)::float8 amount_minor
      from voucher.issuebatch batch join voucher.voucher voucher on voucher.batch_id=batch.id where batch.id=$1 group by batch.program_id`, [batchid]);
    const fact = accounting.rows[0] as { program_id: string; amount_minor: number } | undefined;
    if (!fact || fact.amount_minor <= 0) throw new Error('VOUCHER_ISSUE_ACCOUNTING_MISSING');
    await this.finance.post(database, { scope, referenceType: 'voucher.issue', referenceId: batchid, currency: 'CNY',
      description: 'Voucher batch issued', debit: { code: 'voucher.issue', kind: 'expense' },
      credit: { code: `voucher.program.${fact.program_id}`, kind: 'liability' }, amountMinor: fact.amount_minor });
    await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'voucher.issued',1,'issuebatch',$2,$3,jsonb_build_object('batch',$2,'count',$4,'amountMinor',$5),$1,
      clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
    [`event:voucher:issued:${batchid}`, batchid, scope, batch.issued_count, fact.amount_minor]);
    return true;
  }

  private async expire(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const expired = await client.query<{ id: string; state: string }>(`select id,state from voucher.voucher where expires_at<=clock_timestamp()
        and state in('created','active','bound','reserved','disabled') order by expires_at,id for update skip locked limit 1000`);
      for (const voucher of expired.rows) {
        await client.query(`update voucher.reserve set state='released',version=version+1 where voucher_id=$1 and state in('requested','approved')`, [voucher.id]);
        await client.query(`update voucher.voucher set state='expired',version=version+1 where id=$1`, [voucher.id]);
        await client.query(`insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
          select $1,coalesce(max(sequence),0)+1,$2,'expired','expiryjob','system',clock_timestamp() from voucher.statusevent where voucher_id=$1`,
        [voucher.id, voucher.state]);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async status(batchid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const selected = await client.query<{ scope_id: string; action: string; expires_at: string | null; reason: string; actor_id: string }>(
        `update voucher.statusbatch set state='running',updated_at=clock_timestamp() where id=$1 and state in('queued','running')
        returning scope_id,action,expires_at,reason,actor_id`, [batchid]);
      const batch = selected.rows[0];
      if (!batch) throw new Error('VOUCHER_STATUS_BATCH_NOT_RUNNABLE');
      const items = await client.query<{ voucher_id: string }>(`select voucher_id from voucher.statusitem where batch_id=$1 and state='queued'
        order by voucher_id for update skip locked limit 500`, [batchid]);
      for (const row of items.rows) await this.change(client, batchid, row.voucher_id, batch);
      const totals = await client.query<{ queued: number; succeeded: number; failed: number }>(`select count(*) filter(where state='queued')::integer queued,
        count(*) filter(where state='succeeded')::integer succeeded,count(*) filter(where state='failed')::integer failed
        from voucher.statusitem where batch_id=$1`, [batchid]);
      const counts = totals.rows[0]!;
      await client.query(`update voucher.statusbatch set state=case when $2=0 then 'completed' else 'running' end,
        succeeded_count=$3,failed_count=$4,updated_at=clock_timestamp() where id=$1`, [batchid, counts.queued, counts.succeeded, counts.failed]);
      if (counts.queued > 0) await enqueue(client, 'voucherstatus', batch.scope_id, { batch: batchid });
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async change(client: import('pg').PoolClient, batchid: string, voucherid: string,
    batch: Readonly<{ scope_id: string; action: string; expires_at: string | null; reason: string; actor_id: string }>): Promise<void> {
    await client.query('savepoint voucherstatusitem');
    try {
      const selected = await client.query<{ state: string; member_id: string | null; remaining_minor: number; expires_at: string }>(`select voucher.state,
        voucher.member_id,voucher.remaining_minor::float8 remaining_minor,voucher.expires_at from voucher.voucher voucher
        join voucher.program program on program.id=voucher.program_id where voucher.id=$1 and program.scope_id=$2 for update`, [voucherid, batch.scope_id]);
      const voucher = selected.rows[0];
      if (!voucher) throw new Error('VOUCHER_NOT_FOUND');
      const next = batch.action === 'activate' ? (voucher.member_id === null ? 'active' : 'bound')
        : batch.action === 'disable' ? 'disabled' : batch.action === 'void' ? 'void' : voucher.state;
      if (batch.action === 'extend') {
        if (!['active', 'bound', 'disabled'].includes(voucher.state)) throw new Error('VOUCHER_EXTENSION_STATE_INVALID');
        if (batch.expires_at === null || new Date(batch.expires_at).getTime() <= new Date(voucher.expires_at).getTime()) throw new Error('VOUCHER_EXTENSION_NOT_LATER');
      } else this.policy.assertTransition(voucherState(voucher.state), voucherState(next));
      if (batch.action === 'void' && voucher.remaining_minor > 0) await client.query(`insert into voucher.hold(id,voucher_id,amount_minor,state,reason,evidence,created_at)
        values($1,$2,$3,'open',$4,jsonb_build_object('actor',$5,'batch',$6),clock_timestamp()) on conflict(voucher_id) do nothing`,
      [`hold:${voucherid}`, voucherid, voucher.remaining_minor, batch.reason, batch.actor_id, batchid]);
      await client.query(`update voucher.voucher set state=$2,expires_at=case when $3='extend' then $4::timestamptz else expires_at end,
        version=version+1 where id=$1`, [voucherid, next, batch.action, batch.expires_at]);
      await client.query(`insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,clock_timestamp() from voucher.statusevent where voucher_id=$1`,
      [voucherid, voucher.state, next, batch.reason, batch.actor_id]);
      await client.query(`update voucher.statusitem set state='succeeded',previous_state=$3,next_state=$4,error_code=null,updated_at=clock_timestamp()
        where batch_id=$1 and voucher_id=$2`, [batchid, voucherid, voucher.state, next]);
      await client.query('release savepoint voucherstatusitem');
    } catch (cause) {
      await client.query('rollback to savepoint voucherstatusitem');
      await client.query('release savepoint voucherstatusitem');
      await client.query(`update voucher.statusitem set state='failed',error_code=$3,updated_at=clock_timestamp()
        where batch_id=$1 and voucher_id=$2`, [batchid, voucherid, errorCode(cause)]);
    }
  }
}

async function enqueue(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, kind: string, scope: string, payload: unknown) {
  await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,$2,'voucher',$3,$4::jsonb,'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
  [`job:${randomUUID()}`, kind, scope, JSON.stringify(payload)]);
}

function identifier(payload: unknown, field: string, code: string): string {
  const value = payload !== null && typeof payload === 'object' ? Reflect.get(payload, field) : null;
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function errorCode(cause: unknown): string { return cause instanceof Error ? cause.message.slice(0, 200) : 'VOUCHER_STATUS_FAILED'; }
