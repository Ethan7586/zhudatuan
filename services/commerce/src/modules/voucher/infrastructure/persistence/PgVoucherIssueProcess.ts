import { randomBytes, randomUUID } from 'node:crypto';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { VoucherAccountingPort } from '../../../finance/public/index';
import { enqueue } from './VoucherQueuePersistence';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';

export class PgVoucherIssueProcess {
  private readonly access = new PgTransactionAccess();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly kms: KmsClient,
    private readonly finance: VoucherAccountingPort
  ) {}
  async issue(batchid: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    const options = { tenant: scope, membership: '', scope, actor: 'job:voucherissue', trace: batchid, operation: 'job.voucher.issue', workload: 'jobs' as const, signal, deadline };
    const reserved = await this.transactions.write(options, async (context) => {
      const database = this.access.database(context);
      const batch = await database.query<{
        program_id: string;
        program_version: number;
        cardpool_id: string;
        requested_count: number;
        issued_count: number;
        prefix: string;
        next_sequence: number;
        scope_id: string;
        value_minor: number;
        default_valid_days: number;
        mode: string;
      }>(
        `select batch.program_id,
        batch.program_version::integer,batch.cardpool_id,batch.requested_count,batch.issued_count,pool.code_prefix prefix,pool.next_sequence::float8 next_sequence,
        program.scope_id,pool.mode,version.value_minor::float8 value_minor,version.default_valid_days from voucher.issuebatch batch
        join voucher.program program on program.id=batch.program_id join voucher.programversion version on version.program_id=batch.program_id and version.version=batch.program_version
        join voucher.cardpool pool on pool.id=batch.cardpool_id
        where batch.id=$1 and batch.state='issuing' and pool.status='ready' for update of batch,pool`,
        [batchid]
      );
      const selected = batch.rows[0];
      if (!selected) throw new Error('VOUCHER_ISSUE_BATCH_NOT_RUNNABLE');
      if (selected.mode === 'imported') {
        await this.issueImported(database, batchid, selected);
        return null;
      }
      const count = Math.min(500, selected.requested_count - selected.issued_count);
      if (count <= 0) throw new Error('VOUCHER_ISSUE_BATCH_COMPLETE');
      const values = Array.from({ length: count }, (_, index) => {
        const sequence = selected.next_sequence + index;
        return {
          id: `voucher:${randomUUID()}`,
          code: `${selected.prefix}${String(sequence).padStart(12, '0')}${randomBytes(6).toString('hex').toUpperCase()}`,
          program: selected.program_id,
          version: selected.program_version,
          value: selected.value_minor,
          days: selected.default_valid_days,
        };
      });
      await database.query(`update voucher.cardpool set next_sequence=next_sequence+$2,version=version+1 where id=$1`, [selected.cardpool_id, count]);
      return Object.freeze({ values: Object.freeze(values), scope: selected.scope_id });
    });
    if (!reserved) return;

    const envelopes = await mapParallel(reserved.values, 16, async (item) => ({ item, envelope: await this.kms.encrypt('pii', 'voucher/code', item.code, { voucher: item.id, batch: batchid }) }));
    await this.transactions.write(options, async (context) => {
      const database = this.access.database(context);
      const locked = await database.query(`select 1 from voucher.issuebatch where id=$1 and state='issuing' for update`, [batchid]);
      if (!locked.rows[0]) throw new Error('VOUCHER_ISSUE_BATCH_NOT_RUNNABLE');
      for (const { item, envelope } of envelopes)
        await database.query(
          `insert into voucher.voucher(id,program_id,program_version,batch_id,code_ciphertext,
        code_fingerprint,code_key_version,initial_minor,remaining_minor,state,expires_at,version)
        values($1,$2,$3,$4,$5,$6,$7,$8,$8,'inactive',clock_timestamp()+make_interval(days=>$9),0)`,
          [item.id, item.program, item.version, batchid, envelope.ciphertext, envelope.fingerprint, envelope.keyVersion, item.value, item.days]
        );
      for (const { item } of envelopes)
        await database.query(
          `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        values($1,1,null,'inactive','issuebatch','system',clock_timestamp())`,
          [item.id]
        );
      await this.completeChunk(database, batchid, reserved.scope, envelopes.length);
    });
  }

  private async issueImported(
    database: SqlExecutor,
    batchid: string,
    selected: Readonly<{ cardpool_id: string; program_id: string; program_version: number; requested_count: number; issued_count: number; value_minor: number; default_valid_days: number; scope_id: string }>
  ): Promise<void> {
    const count = Math.min(500, selected.requested_count - selected.issued_count);
    if (count <= 0) throw new Error('VOUCHER_ISSUE_BATCH_COMPLETE');
    const cards = await database.query<{ id: string; code_ciphertext: string; code_fingerprint: string; code_key_version: string }>(
      `select card.id,
      card.code_ciphertext,card.code_fingerprint,card.code_key_version from voucher.card card where card.cardpool_id=$1 and card.state='available'
      order by card.id for update skip locked limit $2`,
      [selected.cardpool_id, count]
    );
    if (cards.rows.length !== count) throw new Error('VOUCHER_CARD_LIBRARY_INSUFFICIENT');
    for (const card of cards.rows) {
      await database.query(`update voucher.card set state='allocated',allocated_batch_id=$2,version=version+1 where id=$1 and state='available'`, [card.id, batchid]);
      await database.query(
        `insert into voucher.voucher(id,program_id,program_version,batch_id,card_id,code_ciphertext,code_fingerprint,code_key_version,
        initial_minor,remaining_minor,state,expires_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,'inactive',
        clock_timestamp()+make_interval(days=>$10),0)`,
        [`voucher:${card.id}`, selected.program_id, selected.program_version, batchid, card.id, card.code_ciphertext, card.code_fingerprint, card.code_key_version, selected.value_minor, selected.default_valid_days]
      );
      await database.query(
        `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        values($1,1,null,'inactive','issuebatch','system',clock_timestamp())`,
        [`voucher:${card.id}`]
      );
    }
    const completed = await this.completeChunk(database, batchid, selected.scope_id, count);
    if (completed)
      await database.query(
        `update voucher.cardpool set status=case when exists(select 1 from voucher.card
      where cardpool_id=$1 and state='available') then 'ready' else 'depleted' end,version=version+1 where id=$1`,
        [selected.cardpool_id]
      );
  }

  private async completeChunk(database: SqlExecutor, batchid: string, scope: string, count: number): Promise<boolean> {
    const updated = await database.query(
      `update voucher.issuebatch set issued_count=issued_count+$2,
      state=case when issued_count+$2=requested_count then 'completed' else 'issuing' end
      where id=$1 and issued_count+$2<=requested_count returning issued_count::integer,requested_count`,
      [batchid, count]
    );
    const batch = updated.rows[0] as { issued_count: number; requested_count: number } | undefined;
    if (!batch) throw new Error('VOUCHER_ISSUE_COUNT_CONFLICT');
    if (batch.issued_count < batch.requested_count) {
      await enqueue(database, 'voucherissue', scope, { batch: batchid });
      return false;
    }
    const accounting = await database.query(
      `select batch.program_id,coalesce(sum(voucher.initial_minor),0)::float8 amount_minor
      from voucher.issuebatch batch join voucher.voucher voucher on voucher.batch_id=batch.id where batch.id=$1 group by batch.program_id`,
      [batchid]
    );
    const fact = accounting.rows[0] as { program_id: string; amount_minor: number } | undefined;
    if (!fact || fact.amount_minor <= 0) throw new Error('VOUCHER_ISSUE_ACCOUNTING_MISSING');
    await this.finance.post(requireWriteTransaction(database.transaction), {
      scope,
      referenceType: 'voucher.issue',
      referenceId: batchid,
      currency: 'CNY',
      description: 'Voucher batch issued',
      debit: { code: 'voucher.issue', kind: 'expense' },
      credit: { code: `voucher.program.${fact.program_id}`, kind: 'liability' },
      amountMinor: fact.amount_minor,
    });
    const event = `event:voucher:issued:${batchid}`;
    await new PgRuntimeWriter(database).append({
      id: event,
      type: 'voucher.issued',
      aggregateType: 'issuebatch',
      aggregate: batchid,
      scope,
      payload: { batch: batchid, count: batch.issued_count, amountMinor: fact.amount_minor },
      trace: event,
    });
    return true;
  }
}
