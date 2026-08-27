<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { createHash } from 'node:crypto';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { createHash } from 'node:crypto';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { FinancePort } from '../../FinancePort';
import type { PayoutGateway } from '../../application/port/PayoutGateway';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';

export class SettlementJobProcessor implements JobProcessor {
  private readonly finance = new FinancePort();
  private readonly policy = new SettlementPolicy();

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  constructor(
    private readonly pool: DatabasePool,
    private readonly payouts: PayoutGateway
  ) {}
<<<<<<< HEAD
=======
  constructor(private readonly pool: DatabasePool, private readonly payouts: PayoutGateway) {}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  constructor(private readonly pool: DatabasePool, private readonly payouts: PayoutGateway) {}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'settlement') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (payload.withdrawal) return this.withdraw(text(payload.withdrawal, 'WITHDRAWAL_REQUIRED'));
    return this.settle(text(payload.reconciliation, 'RECONCILIATION_REQUIRED'));
  }

  private async settle(reconciliation: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      const header = await client.query<{
        scope_id: string;
        partner_id: string;
        period: string;
        created_by: string;
        statement_hash: string;
        statement_period_end: string;
        statement_timezone: string;
        recognition_at: string;
      }>(
        `select reconciliation.scope_id,reconciliation.partner_id,reconciliation.period,reconciliation.created_by,
        reconciliation.statement_hash,statement.period_end::text statement_period_end,
        statement.timezone statement_timezone,(((statement.period_end+1)::timestamp at time zone statement.timezone)
          -interval '1 microsecond')::text recognition_at
        from finance.reconciliation reconciliation join channel.statement statement
          on statement.id=reconciliation.statement_ref and statement.scope_id=reconciliation.scope_id
          and statement.provider=reconciliation.provider and statement.partner_id=reconciliation.partner_id
          and statement.sha256=reconciliation.statement_hash
        where reconciliation.id=$1 and reconciliation.state='approved' and reconciliation.difference_minor=0
        for update of reconciliation,statement`,
        [reconciliation]
      );
      const locked = header.rows[0];
      if (!locked) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      await client.query('select id from finance.reconciliationitem where reconciliation_id=$1 order by id for share', [reconciliation]);
      const source = await client.query<{ gross_minor: string; item_count: number; item_hash: string; excluded_late_count: number; excluded_late_hash: string }>(
        `select payable.gross_minor::text gross_minor,payable.item_count,payable.item_hash,
        excluded.count excluded_late_count,excluded.hash excluded_late_hash
        from(select
        coalesce(sum(case item.kind when 'refund' then -item.internal_minor else item.internal_minor end),0) gross_minor,
        count(*)::integer item_count,
        encode(public.digest(coalesce(string_agg(item.id||':'||item.kind||':'||coalesce(item.internal_type,'')||':'||
          coalesce(item.internal_id,'')||':'||item.internal_minor||':'||item.state,',' order by item.id),''),'sha256'),'hex')
          item_hash from finance.reconciliationitem item where item.reconciliation_id=$1
          and item.state='matched' and item.reason_code is null
          and item.evidence->>'journalReferenceType' in('payment.succeeded','payment.refunded')
          and coalesce((item.evidence->>'settlementEligible')::boolean,false)) payable
        cross join lateral(select count(*)::integer count,
          encode(public.digest(coalesce(string_agg(item.id||':'||item.kind||':'||coalesce(item.internal_type,'')||':'||
            coalesce(item.internal_id,'')||':'||item.internal_minor||':'||item.state,',' order by item.id),''),'sha256'),'hex') hash
          from finance.reconciliationitem item where item.reconciliation_id=$1 and item.state='matched'
            and item.reason_code is null
            and item.evidence->>'journalReferenceType' in('payment.late.detected','payment.late.refunded')
            and not coalesce((item.evidence->>'settlementEligible')::boolean,false)) excluded
        where payable.gross_minor>0 and payable.item_count>0
        and not exists(select 1 from finance.reconciliationitem item where item.reconciliation_id=$1
          and not(item.state='matched' and item.reason_code is null and(
            (item.evidence->>'journalReferenceType' in('payment.succeeded','payment.refunded')
              and coalesce((item.evidence->>'settlementEligible')::boolean,false))
            or(item.evidence->>'journalReferenceType' in('payment.late.detected','payment.late.refunded')
              and not coalesce((item.evidence->>'settlementEligible')::boolean,false)))))`,
        [reconciliation]
      );
      const payable = source.rows[0];
      if (!payable) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      const basis = Object.freeze({ ...locked, ...payable });
      const grossMinor = safeInteger(payable.gross_minor, 'SETTLEMENT_BASIS_OVERFLOW');
      const policy = (
        await client.query<{ id: string; version: number; rule: unknown; rule_hash: string }>(
          `select id,version::float8 version,
        rule,encode(public.digest(id||':'||version||':'||rule::text,'sha256'),'hex') rule_hash from finance.policy
        where scope_id=$1 and kind='settlement' and state='active' for share`,
          [basis.scope_id]
        )
      ).rows[0];
      const frozenRule = policy ?? defaultSettlementRule();
      const split = this.policy.split(grossMinor, frozenRule.rule);
      const frozenEvidence = {
        reconciliation,
        statementHash: basis.statement_hash,
        recognition: {
          occurredAt: basis.recognition_at,
          timezone: basis.statement_timezone,
          statementPeriodEnd: basis.statement_period_end,
        },
        payableBasis: { itemCount: basis.item_count, itemHash: basis.item_hash, grossMinor },
        excludedLateBasis: { itemCount: basis.excluded_late_count, itemHash: basis.excluded_late_hash },
        settlementRule: { id: frozenRule.id, version: frozenRule.version, hash: frozenRule.rule_hash, rule: frozenRule.rule },
        calculation: { grossMinor: split.grossMinor, feeMinor: split.feeMinor, netMinor: split.netMinor, basisPoints: split.basisPoints, invoiceBasis: split.invoiceBasis },
      } as const;
      const result = await client.query<{ id: string; scope_id: string }>(
        `insert into finance.settlement(id,partner_id,period,reconciliation_id,
<<<<<<< HEAD
        amount_minor,currency,state,scope_id,requested_by,frozen_at,evidence,version,gross_minor,fee_minor,invoice_basis)
        values($1,$2,$3,$4,$5,'CNY','draft',$6,$7,clock_timestamp(),$8::jsonb,0,$9,$10,$11)
        on conflict(partner_id,period) do nothing returning id,scope_id`,
        [`settlement:${reconciliation}`, basis.partner_id, basis.period, reconciliation, split.netMinor, basis.scope_id, basis.created_by, JSON.stringify(frozenEvidence), split.grossMinor, split.feeMinor, split.invoiceBasis]
      );
      const settlement = result.rows[0];
      if (!settlement) {
        const replay = await client.query<{ id: string }>(
          `select id from finance.settlement where id=$1 and reconciliation_id=$2
          and partner_id=$3 and period=$4 and scope_id=$5 and amount_minor=$6 and currency='CNY' and gross_minor=$7
          and fee_minor=$8 and invoice_basis=$9 and evidence@>$10::jsonb`,
          [`settlement:${reconciliation}`, reconciliation, basis.partner_id, basis.period, basis.scope_id, split.netMinor, split.grossMinor, split.feeMinor, split.invoiceBasis, JSON.stringify(frozenEvidence)]
        );
        if (!replay.rows[0]) throw new Error('SETTLEMENT_NOT_RUNNABLE');
        await client.query('commit');
        return;
      }
      const invoiceTarget = split.invoiceBasis === 'net' ? split.netMinor : split.grossMinor;
      await client.query('select finance.freeze_settlement_facts($1)', [settlement.id]);
      const total = await client.query<{ lines: number; settlement: number }>(
        `select
        coalesce(sum(case line.direction when 'decrease' then -line.amount_minor else line.amount_minor end),0)::float8 lines,
        settlement.gross_minor::float8 settlement from finance.settlement settlement
        left join finance.settlementline line on line.settlement_id=settlement.id
        where settlement.id=$1 group by settlement.gross_minor`,
        [settlement.id]
      );
      if (!total.rows[0] || total.rows[0].lines !== total.rows[0].settlement) throw new Error('SETTLEMENT_LINE_TOTAL_MISMATCH');
      const lineSnapshot = await client.query<{ count: number; net: number; invoice: number; hash: string }>(
        `select count(*)::integer count,
        coalesce(sum(case direction when 'decrease' then -amount_minor else amount_minor end),0)::float8 net,
        coalesce(sum(invoice_minor),0)::float8 invoice,
        encode(public.digest(coalesce(string_agg(id||':'||reconciliation_item_id||':'||source_type||':'||source_id||':'||
          amount_minor||':'||invoice_minor||':'||tax_minor||':'||direction,',' order by id),''),'sha256'),'hex') hash
        from finance.settlementline where settlement_id=$1`,
        [settlement.id]
      );
      const frozenLines = lineSnapshot.rows[0];
      if (!frozenLines || frozenLines.net !== split.grossMinor || frozenLines.invoice !== invoiceTarget || frozenLines.count !== basis.item_count) {
        throw new Error('SETTLEMENT_FROZEN_BASIS_MISMATCH');
      }
      await client.query(
        `update finance.settlement set evidence=evidence||jsonb_build_object('lineSnapshot',$2::jsonb)
        where id=$1 and state='draft'`,
        [settlement.id, JSON.stringify(frozenLines)]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async withdraw(id: string): Promise<void> {
    const selected = await this.pool.query<{ id: string; destination_ref: string; amount_minor: number; currency: string }>(
      `update finance.withdrawal
      set state='processing',updated_at=clock_timestamp(),version=version+1 where id=$1 and state in('approved','processing')
      returning id,destination_ref,amount_minor::float8 amount_minor,currency`,
      [id]
    );
    const withdrawal = selected.rows[0];
    if (!withdrawal) {
      const complete = await this.pool.query(
        `select 1 from finance.withdrawal where id=$1 and state in('paid','failed','rejected','cancelled')`,
        [id]
      );
      if (complete.rows[0]) return;
      throw new Error('WITHDRAWAL_NOT_RUNNABLE');
    }
    const payout = await this.payouts.submit({ withdrawal: id, destination: withdrawal.destination_ref, amountMinor: withdrawal.amount_minor, currency: withdrawal.currency });
    if (payout.state === 'processing') throw new Error('PAYOUT_PROCESSING');
    if (payout.state === 'failed') {
      await this.pool.query(
        `update finance.withdrawal set state='failed',provider_reference=$2,evidence=evidence||$3::jsonb,
        updated_at=clock_timestamp(),version=version+1 where id=$1 and state='processing'`,
        [id, payout.reference, JSON.stringify({ payoutReason: payout.reason ?? 'PROVIDER_REJECTED' })]
      );
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      const source = await client.query<{ scope_id: string; partner_id: string; period: string; credit_minor: number; created_by: string; statement_hash: string }>(`select
        reconciliation.scope_id,reconciliation.partner_id,reconciliation.period,reconciliation.credit_minor::float8 credit_minor,
        reconciliation.created_by,reconciliation.statement_hash from finance.reconciliation reconciliation where reconciliation.id=$1
        and reconciliation.state='approved' and reconciliation.difference_minor=0 and reconciliation.credit_minor>0
        and not exists(select 1 from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id
          and item.state not in('matched','resolved')) for update`, [reconciliation]);
      const basis = source.rows[0];
      if (!basis) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      const rule = (await client.query<{ rule: unknown }>(`select rule from finance.policy where scope_id=$1 and kind='settlement' and state='active'`,
      [basis.scope_id])).rows[0]?.rule;
      const split = this.policy.split(basis.credit_minor, rule);
      const result = await client.query<{ id: string; scope_id: string }>(`insert into finance.settlement(id,partner_id,period,reconciliation_id,
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
        amount_minor,currency,state,scope_id,requested_by,frozen_at,evidence,version,gross_minor,fee_minor,invoice_basis)
        values($1,$2,$3,$4,$5,'CNY','draft',$6,$7,clock_timestamp(),$8::jsonb,0,$9,$10,$11)
        on conflict(partner_id,period) do nothing returning id,scope_id`,
        [`settlement:${reconciliation}`, basis.partner_id, basis.period, reconciliation, split.netMinor, basis.scope_id, basis.created_by, JSON.stringify(frozenEvidence), split.grossMinor, split.feeMinor, split.invoiceBasis]
      );
      const settlement = result.rows[0];
      if (!settlement) {
        const replay = await client.query<{ id: string }>(
          `select id from finance.settlement where id=$1 and reconciliation_id=$2
          and partner_id=$3 and period=$4 and scope_id=$5 and amount_minor=$6 and currency='CNY' and gross_minor=$7
          and fee_minor=$8 and invoice_basis=$9 and evidence@>$10::jsonb`,
          [`settlement:${reconciliation}`, reconciliation, basis.partner_id, basis.period, basis.scope_id, split.netMinor, split.grossMinor, split.feeMinor, split.invoiceBasis, JSON.stringify(frozenEvidence)]
        );
        if (!replay.rows[0]) throw new Error('SETTLEMENT_NOT_RUNNABLE');
        await client.query('commit');
        return;
      }
      const invoiceTarget = split.invoiceBasis === 'net' ? split.netMinor : split.grossMinor;
      await client.query('select finance.freeze_settlement_facts($1)', [settlement.id]);
      const total = await client.query<{ lines: number; settlement: number }>(
        `select
        coalesce(sum(case line.direction when 'decrease' then -line.amount_minor else line.amount_minor end),0)::float8 lines,
        settlement.gross_minor::float8 settlement from finance.settlement settlement
        left join finance.settlementline line on line.settlement_id=settlement.id
        where settlement.id=$1 group by settlement.gross_minor`,
        [settlement.id]
      );
      if (!total.rows[0] || total.rows[0].lines !== total.rows[0].settlement) throw new Error('SETTLEMENT_LINE_TOTAL_MISMATCH');
      const lineSnapshot = await client.query<{ count: number; net: number; invoice: number; hash: string }>(
        `select count(*)::integer count,
        coalesce(sum(case direction when 'decrease' then -amount_minor else amount_minor end),0)::float8 net,
        coalesce(sum(invoice_minor),0)::float8 invoice,
        encode(public.digest(coalesce(string_agg(id||':'||reconciliation_item_id||':'||source_type||':'||source_id||':'||
          amount_minor||':'||invoice_minor||':'||tax_minor||':'||direction,',' order by id),''),'sha256'),'hex') hash
        from finance.settlementline where settlement_id=$1`,
        [settlement.id]
      );
      const frozenLines = lineSnapshot.rows[0];
      if (!frozenLines || frozenLines.net !== split.grossMinor || frozenLines.invoice !== invoiceTarget || frozenLines.count !== basis.item_count) {
        throw new Error('SETTLEMENT_FROZEN_BASIS_MISMATCH');
      }
      await client.query(
        `update finance.settlement set evidence=evidence||jsonb_build_object('lineSnapshot',$2::jsonb)
        where id=$1 and state='draft'`,
        [settlement.id, JSON.stringify(frozenLines)]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async withdraw(id: string): Promise<void> {
    const selected = await this.pool.query<{ id: string; destination_ref: string; amount_minor: number; currency: string }>(
      `update finance.withdrawal
      set state='processing',updated_at=clock_timestamp(),version=version+1 where id=$1 and state in('approved','processing')
      returning id,destination_ref,amount_minor::float8 amount_minor,currency`,
      [id]
    );
    const withdrawal = selected.rows[0];
    if (!withdrawal) {
      const complete = await this.pool.query(
        `select 1 from finance.withdrawal where id=$1 and state in('paid','failed','rejected','cancelled')`,
        [id]
      );
      if (complete.rows[0]) return;
      throw new Error('WITHDRAWAL_NOT_RUNNABLE');
    }
    const payout = await this.payouts.submit({ withdrawal: id, destination: withdrawal.destination_ref, amountMinor: withdrawal.amount_minor, currency: withdrawal.currency });
    if (payout.state === 'processing') throw new Error('PAYOUT_PROCESSING');
    if (payout.state === 'failed') {
      await this.pool.query(
        `update finance.withdrawal set state='failed',provider_reference=$2,evidence=evidence||$3::jsonb,
        updated_at=clock_timestamp(),version=version+1 where id=$1 and state='processing'`,
<<<<<<< HEAD
      [id, payout.reference, JSON.stringify({ payoutReason: payout.reason ?? 'PROVIDER_REJECTED' })]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        [id, payout.reference, JSON.stringify({ payoutReason: payout.reason ?? 'PROVIDER_REJECTED' })]
      );
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
        amount_minor,currency,state,scope_id,requested_by,frozen_at,evidence,version,gross_minor,fee_minor,invoice_basis)
        values($1,$2,$3,$4,$5,'CNY','draft',$6,$7,clock_timestamp(),jsonb_build_object('reconciliation',$4,'statementHash',$8,
          'splitBasisPoints',$9),0,$10,$11,$12) on conflict(partner_id,period) do nothing returning id,scope_id`,
      [`settlement:${reconciliation}`, basis.partner_id, basis.period, reconciliation, split.netMinor, basis.scope_id, basis.created_by,
        basis.statement_hash, split.basisPoints, split.grossMinor, split.feeMinor, split.invoiceBasis]);
      const settlement = result.rows[0];
      if (!settlement) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      await client.query(`insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
        amount_minor,invoice_minor,tax_minor,direction,state,created_at) select 'settlementline:'||item.id,$1,item.id,$2,
        coalesce(item.internal_type,'statement'),coalesce(item.internal_id,line.external_reference),item.internal_minor,item.internal_minor,
        line.tax_minor,case when line.kind in('refund','fee') then 'decrease' else 'increase' end,'frozen',clock_timestamp()
        from finance.reconciliationitem item join finance.statementline line on line.id=item.statement_line_id
        where item.reconciliation_id=$3 and item.state in('matched','resolved') and item.internal_minor>0
        on conflict(id) do nothing`, [settlement.id, settlement.scope_id, reconciliation]);
      if (split.invoiceBasis === 'net' && split.feeMinor > 0) await client.query(`with eligible as(
          select line.id,line.amount_minor,row_number() over(order by line.id) sequence,count(*) over() count,
            sum(line.amount_minor) over() total from finance.settlementline line
          where line.settlement_id=$1 and line.direction='increase'), allocated as(
          select id,case when sequence=count then $2-coalesce(sum(floor(amount_minor::numeric*$2/total)) over(
            rows between unbounded preceding and 1 preceding),0) else floor(amount_minor::numeric*$2/total) end invoice_minor from eligible)
        update finance.settlementline line set invoice_minor=allocated.invoice_minor from allocated where line.id=allocated.id`,
      [settlement.id, split.netMinor]);
      await client.query(`insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
        values($1,$2,$3,'partner',$4,$5,$6,'frozen',clock_timestamp())`,
      [`split:${settlement.id}:partner`, settlement.id, settlement.scope_id, basis.partner_id, split.netMinor, 10_000-split.basisPoints]);
      if (split.feeMinor > 0) await client.query(`insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,
        basis_points,state,created_at) values($1,$2,$3,'platform','platform',$4,$5,'frozen',clock_timestamp())`,
      [`split:${settlement.id}:platform`, settlement.id, settlement.scope_id, split.feeMinor, split.basisPoints]);
      const total = await client.query<{ lines: number; settlement: number }>(`select
        coalesce(sum(case line.direction when 'decrease' then -line.amount_minor else line.amount_minor end),0)::float8 lines,
        settlement.gross_minor::float8 settlement from finance.settlement settlement
        left join finance.settlementline line on line.settlement_id=settlement.id
        where settlement.id=$1 group by settlement.gross_minor`, [settlement.id]);
      if (!total.rows[0] || total.rows[0].lines !== total.rows[0].settlement) throw new Error('SETTLEMENT_LINE_TOTAL_MISMATCH');
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async withdraw(id: string): Promise<void> {
    const selected = await this.pool.query<{ id: string; destination_ref: string; amount_minor: number; currency: string }>(`update finance.withdrawal
      set state='processing',updated_at=clock_timestamp(),version=version+1 where id=$1 and state in('approved','processing')
      returning id,destination_ref,amount_minor::float8 amount_minor,currency`, [id]);
    const withdrawal = selected.rows[0];
    if (!withdrawal) {
      const complete = await this.pool.query(`select 1 from finance.withdrawal where id=$1 and state in('paid','failed')`, [id]);
      if (complete.rows[0]) return;
      throw new Error('WITHDRAWAL_NOT_RUNNABLE');
    }
    const payout = await this.payouts.submit({ withdrawal: id, destination: withdrawal.destination_ref,
      amountMinor: withdrawal.amount_minor, currency: withdrawal.currency });
    if (payout.state === 'processing') throw new Error('PAYOUT_PROCESSING');
    if (payout.state === 'failed') {
      await this.pool.query(`update finance.withdrawal set state='failed',provider_reference=$2,evidence=evidence||$3::jsonb,
        updated_at=clock_timestamp(),version=version+1 where id=$1 and state='processing'`,
      [id, payout.reference, JSON.stringify({ payoutReason: payout.reason ?? 'PROVIDER_REJECTED' })]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      return;
    }
    const client = await this.pool.connect();
    try {
      await client.query('begin');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      const locked = await client.query<{
        scope_id: string;
        settlement_id: string | null;
        source_kind: 'settlement' | 'referral';
        source_id: string | null;
        beneficiary_member_id: string | null;
        partner_id: string | null;
        amount_minor: number;
        currency: string;
      }>(
        `select
        withdrawal.scope_id,withdrawal.settlement_id,withdrawal.source_kind,withdrawal.source_id,
        withdrawal.beneficiary_member_id,settlement.partner_id,withdrawal.amount_minor::float8 amount_minor,withdrawal.currency
        from finance.withdrawal withdrawal left join finance.settlement settlement on settlement.id=withdrawal.settlement_id
        where withdrawal.id=$1 and withdrawal.state='processing' for update of withdrawal`,
        [id]
      );
<<<<<<< HEAD
      const row = locked.rows[0];
      if (!row) {
        await client.query('commit');
        return;
      }
      const referral = row.source_kind === 'referral';
      if (
        (referral && (row.settlement_id !== null || row.source_id === null || row.beneficiary_member_id === null)) ||
        (!referral && (row.source_kind !== 'settlement' || row.settlement_id === null || row.partner_id === null))
      ) {
        throw new Error('WITHDRAWAL_SOURCE_INVALID');
      }
      await this.finance.post(client, {
        scope: row.scope_id,
        referenceType: referral ? 'referral.withdrawal.paid' : 'finance.withdrawal.paid',
        referenceId: id,
        currency: row.currency,
        description: referral ? 'Referral commission payout' : 'Settlement payout',
        debit: {
          code: referral
            ? `referral.commission.payable.${row.beneficiary_member_id as string}`
            : `settlement.payable.${row.partner_id as string}`,
          kind: 'liability',
        },
        credit: { code: 'cash', kind: 'asset' },
        amountMinor: row.amount_minor,
      });
      await client.query(
        `update finance.withdrawal set state='paid',provider_reference=$2,paid_at=clock_timestamp(),
        updated_at=clock_timestamp(),version=version+1 where id=$1`,
        [id, payout.reference]
      );
      if (!referral) {
        await client.query(
          `update finance.settlement settlement set state='paid',paid_at=clock_timestamp(),version=version+1 where id=$1 and state='payable'
          and amount_minor=(select coalesce(sum(amount_minor),0) from finance.withdrawal where settlement_id=$1 and state='paid')`,
          [row.settlement_id]
        );
        await client.query('select finance.mark_partner_settlement_split_paid($1)', [row.settlement_id]);
      }
      await client.query(
        `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'finance.withdrawal.paid',1,'withdrawal',$2,$3,jsonb_strip_nulls(jsonb_build_object(
          'withdrawal',$2,'settlement',$4,'sourceKind',$5,'sourceId',$6,'beneficiaryMember',$7,'amountMinor',$8,'currency',$9)),
        $1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
        [
          `event:finance:withdrawal:${id}`,
          id,
          row.scope_id,
          row.settlement_id,
          row.source_kind,
          row.source_id,
          row.beneficiary_member_id,
          row.amount_minor,
          row.currency,
        ]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

function defaultSettlementRule(): Readonly<{ id: string; version: number; rule: Readonly<Record<string, unknown>>; rule_hash: string }> {
  const rule = Object.freeze({ basisPoints: 0, invoiceBasis: 'gross' });
  return Object.freeze({
    id: 'finance.policy.default.settlement',
    version: 1,
    rule,
    rule_hash: createHash('sha256')
      .update(`finance.policy.default.settlement:1:${JSON.stringify(rule)}`)
      .digest('hex'),
  });
}

=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      const locked = await client.query<{ scope_id: string; settlement_id: string; partner_id: string; amount_minor: number; currency: string }>(`select
        withdrawal.scope_id,withdrawal.settlement_id,settlement.partner_id,withdrawal.amount_minor::float8 amount_minor,withdrawal.currency
        from finance.withdrawal withdrawal join finance.settlement settlement on settlement.id=withdrawal.settlement_id
        where withdrawal.id=$1 and withdrawal.state='processing' for update`, [id]);
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      const row = locked.rows[0];
      if (!row) {
        await client.query('commit');
        return;
      }
      const referral = row.source_kind === 'referral';
      if (
        (referral && (row.settlement_id !== null || row.source_id === null || row.beneficiary_member_id === null)) ||
        (!referral && (row.source_kind !== 'settlement' || row.settlement_id === null || row.partner_id === null))
      ) {
        throw new Error('WITHDRAWAL_SOURCE_INVALID');
      }
      await this.finance.post(client, {
        scope: row.scope_id,
        referenceType: referral ? 'referral.withdrawal.paid' : 'finance.withdrawal.paid',
        referenceId: id,
        currency: row.currency,
        description: referral ? 'Referral commission payout' : 'Settlement payout',
        debit: {
          code: referral
            ? `referral.commission.payable.${row.beneficiary_member_id as string}`
            : `settlement.payable.${row.partner_id as string}`,
          kind: 'liability',
        },
        credit: { code: 'cash', kind: 'asset' },
        amountMinor: row.amount_minor,
      });
      await client.query(
        `update finance.withdrawal set state='paid',provider_reference=$2,paid_at=clock_timestamp(),
        updated_at=clock_timestamp(),version=version+1 where id=$1`,
        [id, payout.reference]
      );
      if (!referral) {
        await client.query(
          `update finance.settlement settlement set state='paid',paid_at=clock_timestamp(),version=version+1 where id=$1 and state='payable'
          and amount_minor=(select coalesce(sum(amount_minor),0) from finance.withdrawal where settlement_id=$1 and state='paid')`,
          [row.settlement_id]
        );
        await client.query('select finance.mark_partner_settlement_split_paid($1)', [row.settlement_id]);
      }
      await client.query(
        `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'finance.withdrawal.paid',1,'withdrawal',$2,$3,jsonb_strip_nulls(jsonb_build_object(
          'withdrawal',$2,'settlement',$4,'sourceKind',$5,'sourceId',$6,'beneficiaryMember',$7,'amountMinor',$8,'currency',$9)),
        $1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
        [
          `event:finance:withdrawal:${id}`,
          id,
          row.scope_id,
          row.settlement_id,
          row.source_kind,
          row.source_id,
          row.beneficiary_member_id,
          row.amount_minor,
          row.currency,
        ]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
function defaultSettlementRule(): Readonly<{ id: string; version: number; rule: Readonly<Record<string, unknown>>; rule_hash: string }> {
  const rule = Object.freeze({ basisPoints: 0, invoiceBasis: 'gross' });
  return Object.freeze({
    id: 'finance.policy.default.settlement',
    version: 1,
    rule,
    rule_hash: createHash('sha256')
      .update(`finance.policy.default.settlement:1:${JSON.stringify(rule)}`)
      .digest('hex'),
  });
}

>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
      const row = locked.rows[0];
      if (!row) { await client.query('commit'); return; }
      await this.finance.post(client, { scope: row.scope_id, referenceType: 'finance.withdrawal.paid', referenceId: id,
        currency: row.currency, description: 'Settlement payout', debit: { code: `settlement.payable.${row.partner_id}`, kind: 'liability' },
        credit: { code: 'cash', kind: 'asset' }, amountMinor: row.amount_minor });
      await client.query(`update finance.withdrawal set state='paid',provider_reference=$2,paid_at=clock_timestamp(),
        updated_at=clock_timestamp(),version=version+1 where id=$1`, [id, payout.reference]);
      await client.query(`update finance.settlement settlement set state='paid',paid_at=clock_timestamp(),version=version+1 where id=$1 and state='payable'
        and amount_minor=(select coalesce(sum(amount_minor),0) from finance.withdrawal where settlement_id=$1 and state='paid')`, [row.settlement_id]);
      await client.query(`update finance.split set state='paid' where settlement_id=$1 and beneficiary_type='partner' and state='frozen'
        and exists(select 1 from finance.settlement where id=$1 and state='paid')`, [row.settlement_id]);
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'finance.withdrawal.paid',1,'withdrawal',$2,$3,jsonb_build_object('withdrawal',$2,'settlement',$4,'amountMinor',$5,'currency',$6),
        $1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [`event:finance:withdrawal:${id}`, id, row.scope_id, row.settlement_id, row.amount_minor, row.currency]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
function safeInteger(value: unknown, code: string): number {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)$/.test(value)) throw new Error(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(code);
  return parsed;
}
<<<<<<< HEAD
=======
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
