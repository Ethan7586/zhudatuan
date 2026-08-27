import { randomUUID } from 'node:crypto';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
import { FinancePort } from '../../../finance/FinanceModule';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { FinancePort } from '../../../finance/FinanceModule';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

interface VoucherDatabase {
  query<R extends object = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
interface FinancialPosting {
  post(database: VoucherDatabase, intent: Readonly<{
    scope: string;
    referenceType: string;
    referenceId: string;
    currency: string;
    description: string;
    debit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
    credit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
    amountMinor: number;
    occurredAt?: string;
  }>): Promise<string>;
}

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export interface VoucherChoice { readonly id: string; readonly remaining_minor: number; readonly version: number; readonly program: string }
export interface VoucherTender { readonly reference: string; readonly amountMinor: number }
export interface VoucherRefund {
  readonly refund: string; readonly order: string; readonly member: string; readonly voucher: string; readonly amountMinor: number;
}

/** Public voucher boundary. It owns eligibility, locks, state events, redemption, reversal, and accounting facts. */
export class VoucherPort {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  constructor(private readonly finance?: FinancialPosting) {}
=======
  constructor(private readonly finance = new FinancePort()) {}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  constructor(private readonly finance?: FinancialPosting) {}
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  constructor(private readonly finance = new FinancePort()) {}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  async preview(database: VoucherDatabase, vouchers: readonly string[], member: string, scope: string): Promise<readonly VoucherChoice[]> {
    if (vouchers.length === 0) return [];
    return (await database.query<VoucherChoice>(`select voucher.id,voucher.remaining_minor::float8 remaining_minor,
      voucher.version::float8 version,program.id program from voucher.voucher voucher join voucher.program program on program.id=voucher.program_id
      where voucher.id=any($1::text[]) and voucher.member_id=$2 and program.scope_id=$3 and program.status='active'
      and voucher.state in('active','bound') and voucher.expires_at>clock_timestamp() order by voucher.id`, [vouchers, member, scope])).rows;
  }

  async reserve(database: VoucherDatabase, order: string, member: string, scope: string, tenders: readonly VoucherTender[]): Promise<void> {
    if (tenders.length === 0) return;
    const normalized = [...tenders].sort((left, right) => left.reference.localeCompare(right.reference));
    const ids = normalized.map(({ reference }) => reference);
    if (new Set(ids).size !== ids.length) throw new Error('VOUCHER_SELECTION_DUPLICATE');
    const rows = (await database.query<{ id: string; remaining_minor: number; state: string }>(`select voucher.id,
      voucher.remaining_minor::float8 remaining_minor,voucher.state from voucher.voucher voucher
      join voucher.program program on program.id=voucher.program_id where voucher.id=any($1::text[])
      and voucher.member_id=$2 and program.scope_id=$3 and program.status='active' and voucher.state in('active','bound')
      and voucher.expires_at>clock_timestamp() order by voucher.id for update of voucher`, [ids, member, scope])).rows;
    if (rows.length !== normalized.length) throw new Error('VOUCHER_NOT_USABLE');
    for (const tender of normalized) {
      if (!Number.isSafeInteger(tender.amountMinor) || tender.amountMinor <= 0) throw new Error('VOUCHER_TENDER_AMOUNT_INVALID');
      const voucher = rows.find(({ id }) => id === tender.reference)!;
      if (voucher.remaining_minor < tender.amountMinor) throw new Error('VOUCHER_BALANCE_INSUFFICIENT');
      await database.query(`insert into voucher.reserve(id,voucher_id,owner_id,state,expires_at,version)
        values($1,$2,$3,'approved',clock_timestamp()+interval '30 minutes',0)`, [`voucherreserve:${randomUUID()}`, voucher.id, order]);
      await database.query(`update voucher.voucher set state='reserved',version=version+1 where id=$1`, [voucher.id]);
      await status(database, voucher.id, voucher.state, 'reserved', 'orderreserve');
    }
  }

  async release(database: VoucherDatabase, order: string): Promise<void> {
    const reservations = await database.query<{ voucher_id: string }>(`update voucher.reserve set state='released',version=version+1
      where owner_id=$1 and state in('requested','approved') returning voucher_id`, [order]);
    if (reservations.rows.length === 0) return;
    const restored = await database.query<{ id: string; state: string }>(`update voucher.voucher
      set state=case when member_id is null then 'active' else 'bound' end,version=version+1
      where id=any($1::text[]) and state='reserved' returning id,state`, [reservations.rows.map(({ voucher_id }) => voucher_id)]);
    for (const voucher of restored.rows) await status(database, voucher.id, 'reserved', voucher.state, 'orderrelease');
  }

  async consume(database: VoucherDatabase, order: string, member: string, voucherid: string, amountMinor: number): Promise<void> {
    const reserved = await database.query(`update voucher.reserve set state='consumed',version=version+1 where voucher_id=$1 and owner_id=$2
      and state='approved' returning id`, [voucherid, order]);
    if (!reserved.rows[0]) throw new Error('VOUCHER_HOLD_MISSING');
    const voucher = await database.query<{ state: string; scope_id: string; program_id: string }>(`update voucher.voucher voucher
      set remaining_minor=remaining_minor-$2,state=case when remaining_minor=$2 then 'redeemed' else 'bound' end,version=version+1
      from voucher.program program where voucher.id=$1 and voucher.member_id=$3 and voucher.remaining_minor>=$2 and voucher.state='reserved'
      and program.id=voucher.program_id returning voucher.state,program.scope_id,program.id program_id`, [voucherid, amountMinor, member]);
    const selected = voucher.rows[0];
    if (!selected) throw new Error('VOUCHER_BALANCE_INSUFFICIENT');
    const redemption = await database.query(`insert into voucher.redemption(id,voucher_id,verification_id,order_id,amount_minor,redeemed_at,version)
      values($1,$2,$3,$4,$5,clock_timestamp(),0) on conflict(verification_id) do nothing returning id`,
    [`redemption:${randomUUID()}`, voucherid, `order:${order}:${voucherid}`, order, amountMinor]);
    if (!redemption.rows[0]) throw new Error('VOUCHER_REDEMPTION_DUPLICATE');
    await status(database, voucherid, 'reserved', selected.state, 'orderpayment');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    await this.financial().post(database, { scope: selected.scope_id, referenceType: 'voucher.redeem', referenceId: `${order}:${voucherid}`,
=======
    await this.finance.post(database, { scope: selected.scope_id, referenceType: 'voucher.redeem', referenceId: `${order}:${voucherid}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    await this.financial().post(database, { scope: selected.scope_id, referenceType: 'voucher.redeem', referenceId: `${order}:${voucherid}`,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    await this.finance.post(database, { scope: selected.scope_id, referenceType: 'voucher.redeem', referenceId: `${order}:${voucherid}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      currency: 'CNY', description: 'Voucher redemption', debit: { code: `voucher.program.${selected.program_id}`, kind: 'liability' },
      credit: { code: 'commerce.clearing', kind: 'income' }, amountMinor });
  }

  async refund(database: VoucherDatabase, input: VoucherRefund): Promise<void> {
    const redemption = (await database.query<{ id: string; amount_minor: number; state: string; scope_id: string; program_id: string }>(`select
      redemption.id,redemption.amount_minor::float8 amount_minor,voucher.state,program.scope_id,program.id program_id
      from voucher.redemption redemption join voucher.voucher voucher on voucher.id=redemption.voucher_id
      join voucher.program program on program.id=voucher.program_id where redemption.voucher_id=$1 and redemption.order_id=$2
      and voucher.member_id=$3 for update of redemption,voucher`, [input.voucher, input.order, input.member])).rows[0];
    if (!redemption) throw new Error('VOUCHER_REFUND_REDEMPTION_MISSING');
    const prior = await database.query<{ amount: number }>(`select coalesce(sum(amount_minor),0)::float8 amount from voucher.reversal
      where redemption_id=$1 and state='reversed'`, [redemption.id]);
    if ((prior.rows[0]?.amount ?? 0) + input.amountMinor > redemption.amount_minor) throw new Error('VOUCHER_REFUND_EXCEEDS_REDEMPTION');
    const reversal = await database.query(`insert into voucher.reversal(id,redemption_id,reference_id,amount_minor,state,reason,evidence,occurred_at)
      values($1,$2,$3,$4,'reversed','paymentrefund',jsonb_build_object('refund',$3),clock_timestamp())
      on conflict(redemption_id,reference_id) do nothing returning id`, [`reversal:${randomUUID()}`, redemption.id, input.refund, input.amountMinor]);
    if (!reversal.rows[0]) return;
    const restored = await database.query<{ state: string }>(`update voucher.voucher set remaining_minor=remaining_minor+$2,
      state=case when member_id is null then 'active' else 'bound' end,version=version+1 where id=$1 returning state`, [input.voucher, input.amountMinor]);
    await status(database, input.voucher, redemption.state, restored.rows[0]!.state, 'paymentrefund');
    await database.query(`update voucher.redemption set reversed_at=case when (select coalesce(sum(amount_minor),0) from voucher.reversal
      where redemption_id=$1 and state='reversed')>=amount_minor then clock_timestamp() else null end,version=version+1 where id=$1`, [redemption.id]);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    await this.financial().post(database, { scope: redemption.scope_id, referenceType: 'voucher.refund', referenceId: `${input.refund}:${input.voucher}`,
=======
    await this.finance.post(database, { scope: redemption.scope_id, referenceType: 'voucher.refund', referenceId: `${input.refund}:${input.voucher}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    await this.financial().post(database, { scope: redemption.scope_id, referenceType: 'voucher.refund', referenceId: `${input.refund}:${input.voucher}`,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    await this.finance.post(database, { scope: redemption.scope_id, referenceType: 'voucher.refund', referenceId: `${input.refund}:${input.voucher}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      currency: 'CNY', description: 'Voucher redemption refund', debit: { code: 'commerce.refund', kind: 'expense' },
      credit: { code: `voucher.program.${redemption.program_id}`, kind: 'liability' }, amountMinor: input.amountMinor });
  }

  async redeemableScope(database: VoucherDatabase, voucher: string, member: string): Promise<string | null> {
    const result = await database.query<{ scope_id: string }>(`select program.scope_id from voucher.voucher voucher
      join voucher.program program on program.id=voucher.program_id where voucher.id=$1 and voucher.member_id=$2
      and voucher.state in('active','bound') and voucher.remaining_minor>0 and voucher.expires_at>clock_timestamp()
      and program.status='active'`, [voucher, member]);
    return result.rows[0]?.scope_id ?? null;
  }

  async redeemVerification(database: VoucherDatabase, input: Readonly<{ voucher: string; verification: string; scope: string; actor: string }>) {
    const id = `redemption:${input.verification}`;
    const changed = await database.query<{ id: string; amount_minor: number; previous_state: string }>(`with locked as (
        select voucher.id,voucher.remaining_minor,voucher.state previous_state from voucher.voucher voucher
        join voucher.program program on program.id=voucher.program_id where voucher.id=$1 and program.scope_id=$2
        and program.status='active' and voucher.state in('active','bound') and voucher.remaining_minor>0
        and voucher.expires_at>clock_timestamp() for update
      ), redemption as (insert into voucher.redemption(id,voucher_id,verification_id,amount_minor,redeemed_at,version)
        select $3,id,$4,remaining_minor,clock_timestamp(),0 from locked on conflict(verification_id) do nothing
        returning voucher_id,amount_minor)
      update voucher.voucher target set remaining_minor=0,state='redeemed',version=target.version+1 from locked,redemption
      where target.id=locked.id and redemption.voucher_id=target.id
      returning target.id,redemption.amount_minor::float8 amount_minor,locked.previous_state`,
    [input.voucher, input.scope, id, input.verification]);
    const accepted = changed.rows[0];
    if (!accepted) return null;
    await database.query(`insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
      select $1,coalesce(max(sequence),0)+1,$2,'redeemed','store_verification',$3,clock_timestamp()
      from voucher.statusevent where voucher_id=$1`, [input.voucher, accepted.previous_state, input.actor]);
    return { id, amountMinor: accepted.amount_minor };
  }
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

  private financial(): FinancialPosting {
    if (!this.finance) throw new Error('VOUCHER_FINANCE_DEPENDENCY_REQUIRED');
    return this.finance;
  }
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

async function status(database: VoucherDatabase, voucher: string, previous: string, next: string, reason: string): Promise<void> {
  await database.query(`insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
    select $1,coalesce(max(sequence),0)+1,$2,$3,$4,'system',clock_timestamp() from voucher.statusevent where voucher_id=$1`,
  [voucher, previous, next, reason]);
}
