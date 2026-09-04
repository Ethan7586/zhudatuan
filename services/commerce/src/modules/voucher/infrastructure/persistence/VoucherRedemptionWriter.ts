import { randomUUID } from 'node:crypto';
import type { OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { VoucherAccountingPort } from '../../../finance/public';
import type { OrganizationReadPort } from '../../../organization/public';
import { Voucher, type VoucherState } from '../../domain/model/Voucher';
import { Redemption } from '../../domain/model/Redemption';
import { redemptionEventId } from '../../domain/event/VoucherEvents';
import { HOLD_FIELDS, normalize, REDEMPTION, VOUCHER_FIELDS } from './VoucherSupport';
import { VoucherRedemptionEvents } from './VoucherRedemptionEvents';

export interface RedemptionCommand { readonly context: WriteTransactionContext; readonly scope: string; readonly voucher: string; readonly hold: string | null; readonly expectedHoldVersion?: number; readonly verification: string; readonly order: string | null; readonly store?: string; readonly amountMinor: number; readonly idempotency: string; readonly actor: string; readonly now: Date; }
type VerificationCommand = Pick<RedemptionCommand, 'context' | 'scope' | 'voucher' | 'verification' | 'actor' | 'now' | 'store'>;
type ReplayCommand = Omit<RedemptionCommand, 'amountMinor'> & { readonly amountMinor?: number };
type RedemptionReceipt = OperationOutputFor<'voucher.redemptions.create'>;
export class VoucherRedemptionWriter {
  private readonly events: VoucherRedemptionEvents;
  constructor(private readonly finance: VoucherAccountingPort, organizations: Pick<OrganizationReadPort, 'scope'>, private readonly transactions = new PgTransactionAccess()) {
    this.events = new VoucherRedemptionEvents(organizations);
  }
  async redeem(command: RedemptionCommand): Promise<OperationOutputFor<'voucher.redemptions.create'>> {
    if (!command.voucher || !command.verification || !command.idempotency || !Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0) {
      throw new DomainError('VALIDATION_FAILED');
    }
    const prior = await this.replay(command);
    if (prior) return prior;
    const row = await this.lock(command);
    if (!row) throw new DomainError('VOUCHER_NOT_REDEEMABLE');
    return this.record(command, row);
  }

  async redeemVerified(input: VerificationCommand): Promise<RedemptionReceipt | null> {
    if (!input.voucher || !input.verification) throw new DomainError('VALIDATION_FAILED');
    const command = { ...input, hold: null, order: null, idempotency: `verification:${input.verification}` };
    // The receipt is authoritative even after all value is spent or the voucher
    // expires. Never infer a retry's amount from today's remaining balance.
    const prior = await this.replay(command);
    if (prior) return prior;
    const row = await this.lock(command);
    if (!row || row.state !== 'active' || Number(row.remaining_minor) <= 0 || row.starts_at > input.now || row.expires_at <= input.now) return null;
    return this.record({ ...command, amountMinor: Number(row.remaining_minor) }, row);
  }

  private async replay(command: ReplayCommand): Promise<RedemptionReceipt | null> {
    const database = this.transactions.database(command.context);
    const prior = await database.query(`${REDEMPTION} where redemption.scope_id=$1 and (redemption.idempotency_key=$2 or redemption.verification_id=$3)`, [command.scope, command.idempotency, command.verification]);
    if (prior.rows[0]) {
      const row = prior.rows[0] as { voucher: string; amountMinor: number; verification: string; hold: string | null; order: string | null };
      if (prior.rows.length !== 1 || row.voucher !== command.voucher || (command.amountMinor !== undefined && Number(row.amountMinor) !== command.amountMinor) ||
        row.verification !== command.verification || row.hold !== command.hold || row.order !== command.order) throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
      return normalize(prior.rows[0]) as OperationOutputFor<'voucher.redemptions.create'>;
    }
    return null;
  }

  private async lock(command: Pick<RedemptionCommand, 'context' | 'voucher' | 'scope'>): Promise<VoucherRow | undefined> {
    return (await this.transactions.database(command.context).query<VoucherRow>(`select ${VOUCHER_FIELDS} from voucher.voucher voucher
      where voucher.id=$1 and voucher.scope_id=$2 for update of voucher`, [command.voucher, command.scope])).rows[0];
  }

  private async record(command: RedemptionCommand, row: VoucherRow): Promise<RedemptionReceipt> {
    const database = this.transactions.database(command.context);
    if (row.starts_at > command.now || row.expires_at <= command.now) throw new DomainError('VOUCHER_NOT_REDEEMABLE');
    if (command.hold) {
      const held = await database.query<HoldRow>(`select ${HOLD_FIELDS} from voucher.tenderhold hold where hold.id=$1 and hold.voucher_id=$2 and hold.scope_id=$3 for update`, [command.hold, command.voucher, command.scope]);
      const hold = held.rows[0]; if (!hold || hold.state !== 'active') throw new DomainError('VOUCHER_HOLD_CONFLICT'); if (hold.expires_at <= command.now) throw new DomainError('VOUCHER_HOLD_EXPIRED');
      if (command.expectedHoldVersion !== undefined && Number(hold.version) !== command.expectedHoldVersion) throw new DomainError('VERSION_CONFLICT');
      if (Number(hold.amount_minor) !== command.amountMinor || row.state !== 'held' || (command.order !== null && hold.owner_id !== command.order)) throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
      await database.query(`update voucher.tenderhold set state='consumed',version=version+1 where id=$1 and scope_id=$2`, [hold.id, command.scope]);
    } else if (row.state !== 'active') throw new DomainError('VOUCHER_NOT_REDEEMABLE');
    const aggregate = new Voucher({ id: row.id, credential: row.credential_id, product: row.product_id, holder: row.holder_id, initialMinor: Number(row.initial_minor), remainingMinor: Number(row.remaining_minor), state: row.state, startsAt: new Date(row.starts_at), expiresAt: new Date(row.expires_at), version: Number(row.version) });
    const redeemed = command.hold ? aggregate.redeem(command.amountMinor) : aggregate.redeemAtomic(command.amountMinor);
    const redemption = new Redemption({ id: `redemption:${randomUUID()}`, voucher: row.id, hold: command.hold, verification: command.verification, amountMinor: command.amountMinor, refundedMinor: 0, state: 'succeeded', version: 1 });
    const id = redemption.value.id;
    const snapshot = await this.events.snapshot(command.context, command);
    await database.query(`update voucher.voucher set remaining_minor=$3,state=$4,version=$5 where id=$1 and scope_id=$2`, [row.id, command.scope, redeemed.value.remainingMinor, redeemed.value.state, redeemed.value.version]);
    await database.query(`insert into voucher.redemption(id,scope_id,voucher_id,hold_id,verification_id,order_id,amount_minor,refunded_minor,currency,state,idempotency_key,version,redeemed_at,updated_at,channel,store_id,reporting_scopes,timezone)
      values($1,$2,$3,$4,$5,$6,$7,0,$8,'succeeded',$9,1,$10,$10,$11,$12,$13,$14)`, [id, command.scope, row.id, command.hold, command.verification, command.order, command.amountMinor, row.currency, command.idempotency, command.now,
        snapshot.channel, snapshot.store, snapshot.scopes, snapshot.timezone]);
    await timeline(database, row.id, command.scope, row.state, redeemed.value.state, command.hold ? 'holdconsume' : 'atomicredeem', command.actor, command.now, id);
    await this.events.append(command.context, { ...command, redemption: id, currency: row.currency, version: redeemed.value.version }, snapshot);
    await this.finance.post(command.context, { scopeId: command.scope, source: { module: 'voucher', aggregate: 'redemption', aggregateId: id, event: 'voucher.redeem', eventId: redemptionEventId(id), leg: 'redeem' }, currency: row.currency, description: '卡券核销', debit: { code: `voucher.product.${row.product_id}`, kind: 'liability' }, credit: { code: 'commerce.clearing', kind: 'income' }, amountMinor: command.amountMinor, occurredAt: command.now.toISOString() });
    return normalize((await database.query(`${REDEMPTION} where redemption.id=$1 and redemption.scope_id=$2`, [id, command.scope])).rows[0]) as OperationOutputFor<'voucher.redemptions.create'>;
  }
}
interface VoucherRow { readonly id: string; readonly credential_id: string; readonly product_id: string; readonly holder_id: string | null; readonly initial_minor: number; readonly remaining_minor: number; readonly currency: string; readonly state: VoucherState; readonly starts_at: Date; readonly expires_at: Date; readonly version: number; }
interface HoldRow { readonly id: string; readonly owner_id: string; readonly state: string; readonly expires_at: Date; readonly amount_minor: number; readonly version: number; }
export async function timeline(database: ReturnType<PgTransactionAccess['database']>, voucher: string, scope: string, previous: string | null, next: string, reason: string, actor: string, now: Date, redemption: string | null = null) {
  await database.query(`insert into voucher.timeline(voucher_id,scope_id,sequence,previous_state,next_state,reason,actor_id,occurred_at,redemption_id)
    select $1,$2,coalesce(max(sequence),0)+1,$3,$4,$5,$6,$7,$8 from voucher.timeline where voucher_id=$1 and scope_id=$2`,
    [voucher, scope, previous, next, reason, actor, now, redemption]);
}
