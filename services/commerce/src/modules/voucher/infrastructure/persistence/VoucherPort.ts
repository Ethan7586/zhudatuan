import { randomUUID } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { VOUCHER_TERMS } from './IssueTerms';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { VoucherAccountingPort } from '../../../finance/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type {
  CheckoutVoucherGateway,
  FulfillmentVoucherItem,
  FulfillmentVoucherPort,
  FulfillmentVoucherReceipt,
  PaymentVoucherPort,
  VerificationVoucherPort,
  VoucherChoice,
  VoucherRefund,
  VoucherTender,
} from '../../public';
import { VoucherRefundWriter } from './VoucherRefundWriter';
import { timeline, VoucherRedemptionWriter } from './VoucherRedemptionWriter';
import { VoucherTenderWriter } from './VoucherTenderWriter';
import { HOLD_FIELDS, VOUCHER_FIELDS } from './VoucherSupport';

export class VoucherPort implements CheckoutVoucherGateway, PaymentVoucherPort, VerificationVoucherPort, FulfillmentVoucherPort {
  private readonly transactions = new PgTransactionAccess();
  private readonly tenders = new VoucherTenderWriter(this.transactions);

  constructor(private readonly finance?: VoucherAccountingPort, private readonly organizations?: Pick<OrganizationReadPort, 'scope'>) {}

  async preview(context: ReadTransactionContext, vouchers: readonly string[], member: string, scope: string): Promise<readonly VoucherChoice[]> {
    if (vouchers.length === 0) return Object.freeze([]);
    const rows = await this.transactions.database(context).query<VoucherChoice>(
      `select voucher.id,voucher.remaining_minor::integer as "remainingMinor",voucher.version::integer,
      voucher.product_id as product from voucher.voucher voucher
      join voucher.holder holder on holder.id=voucher.holder_id and holder.scope_id=voucher.scope_id and holder.state='bound'
      where voucher.id=any($1::text[]) and voucher.scope_id=$2 and holder.member_id=$3
      and voucher.state='active' and voucher.remaining_minor>0 and voucher.starts_at<=clock_timestamp() and voucher.expires_at>clock_timestamp()
      order by voucher.id`,
      [[...new Set(vouchers)], scope, member]
    );
    return Object.freeze(rows.rows.map((row) => Object.freeze(row)));
  }

  async available(context: ReadTransactionContext, member: string, scope: string): Promise<readonly VoucherChoice[]> {
    const rows = await this.transactions.database(context).query<{ id: string }>(
      `select voucher.id from voucher.voucher voucher
      join voucher.holder holder on holder.id=voucher.holder_id and holder.scope_id=voucher.scope_id and holder.state='bound'
      where voucher.scope_id=$1 and holder.member_id=$2 and voucher.state='active'
      and voucher.remaining_minor>0 and voucher.starts_at<=clock_timestamp() and voucher.expires_at>clock_timestamp()
      order by voucher.expires_at,voucher.id limit 100`,
      [scope, member]
    );
    return this.preview(context, rows.rows.map(({ id }) => id), member, scope);
  }

  async reserve(context: WriteTransactionContext, order: string, member: string, scope: string, tenders: readonly VoucherTender[]): Promise<void> {
    if (tenders.length === 0) return;
    const normalized = [...tenders].sort((left, right) => left.reference.localeCompare(right.reference));
    if (!order || !member || !scope || new Set(normalized.map(({ reference }) => reference)).size !== normalized.length) {
      throw new DomainError('VOUCHER_HOLD_CONFLICT');
    }
    for (const tender of normalized) {
      await this.tenders.reserve({ context, scope, voucher: tender.reference, owner: order, member,
        amountMinor: tender.amountMinor, ttlSeconds: RUNTIME_LIMITS.voucherTender.holdTtlSeconds,
        idempotency: `checkout:${order}:${tender.reference}`, actor: context.actor, now: new Date() });
    }
  }

  async release(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const holds = await database.query<HoldRow>(`select ${HOLD_FIELDS} from voucher.tenderhold hold where hold.owner_id=$1 and hold.scope_id=$2 and hold.state='active' order by hold.voucher_id,hold.id`, [order, context.scope]);
    for (const hold of holds.rows) {
      await this.tenders.release({ context, scope: context.scope, hold: hold.id, ifActive: true,
        reason: 'checkoutrelease', actor: context.actor, now: new Date() });
    }
  }

  async consume(context: WriteTransactionContext, order: string, member: string, voucher: string, amountMinor: number): Promise<void> {
    const held = await this.transactions.database(context).query<HoldRow & { member_id: string }>(
      `select ${HOLD_FIELDS},holder.member_id from voucher.tenderhold hold
      join voucher.voucher voucher on voucher.id=hold.voucher_id and voucher.scope_id=hold.scope_id
      join voucher.holder holder on holder.id=voucher.holder_id and holder.scope_id=voucher.scope_id and holder.state='bound'
      where hold.voucher_id=$1 and hold.owner_id=$2 and hold.scope_id=$3 and hold.state in('active','consumed')`,
      [voucher, order, context.scope]
    );
    const hold = held.rows[0];
    if (!hold || hold.member_id !== member || Number(hold.amount_minor) !== amountMinor) throw new DomainError('VOUCHER_HOLD_CONFLICT');
    await this.redemptions().redeem({
      context,
      scope: hold.scope_id,
      voucher,
      hold: hold.id,
      verification: `order:${order}:${voucher}`,
      order,
      amountMinor,
      idempotency: `checkoutconsume:${order}:${voucher}`,
      actor: context.actor,
      now: new Date(),
    });
  }

  async refund(context: WriteTransactionContext, input: VoucherRefund): Promise<void> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new DomainError('VALIDATION_FAILED');
    const selected = await this.transactions.database(context).query<{ id: string; scope_id: string }>(
      `select redemption.id,redemption.scope_id from voucher.redemption redemption
      join voucher.holder holder on holder.id=redemption.holder_id and holder.scope_id=redemption.scope_id and holder.voucher_id=redemption.voucher_id
      where redemption.voucher_id=$1 and redemption.order_id=$2 and holder.member_id=$3 and redemption.scope_id=$4 order by redemption.redeemed_at desc limit 1`,
      [input.voucher, input.order, input.member, context.scope]
    );
    const redemption = selected.rows[0];
    if (!redemption) throw new DomainError('RESOURCE_NOT_FOUND');
    await new VoucherRefundWriter(this.accounting(), this.transactions).refund({
      context,
      scope: redemption.scope_id,
      redemption: redemption.id,
      amountMinor: input.amountMinor,
      reason: '支付退款返还卡券余额',
      idempotency: `payment:${input.refund}:${input.voucher}`,
      actor: context.actor,
      now: new Date(),
    });
  }

  async redeemableScope(context: ReadTransactionContext, voucher: string, member: string): Promise<string | null> {
    const row = await this.transactions.database(context).query<{ scope_id: string }>(
      `select voucher.scope_id from voucher.voucher voucher
      join voucher.holder holder on holder.id=voucher.holder_id and holder.scope_id=voucher.scope_id and holder.state='bound'
      where voucher.id=$1 and holder.member_id=$2 and voucher.state='active'
      and voucher.remaining_minor>0 and voucher.starts_at<=clock_timestamp() and voucher.expires_at>clock_timestamp()`,
      [voucher, member]
    );
    return row.rows[0]?.scope_id ?? null;
  }

  async redeemVerification(
    context: WriteTransactionContext,
    input: Readonly<{ voucher: string; verification: string; scope: string; store: string; actor: string }>
  ): Promise<Readonly<{ id: string; amountMinor: number }> | null> {
    const redeemed = await this.redemptions().redeemVerified({ context, ...input, now: new Date() });
    return redeemed ? Object.freeze({ id: redeemed.id, amountMinor: redeemed.amountMinor }) : null;
  }

  async issue(
    context: WriteTransactionContext,
    input: Readonly<{ fulfillment: string; order: string; scope: string; member: string; items: readonly FulfillmentVoucherItem[] }>
  ): Promise<FulfillmentVoucherReceipt> {
    if (!input.fulfillment || !input.order || !input.scope || !input.member || input.items.length === 0) throw new Error('VOUCHER_FULFILLMENT_INVALID');
    const items = [...input.items].sort((left, right) => left.line.localeCompare(right.line));
    if (new Set(items.map(({ line }) => line)).size !== items.length) throw new Error('VOUCHER_FULFILLMENT_LINE_DUPLICATE');
    const database = this.transactions.database(context);
    const issued: string[] = [];
    for (const item of items) {
      if (!item.line || !item.product || !item.sku || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error('VOUCHER_FULFILLMENT_ITEM_INVALID');
      const reason = `fulfillment:${input.fulfillment}:${item.line}`;
      await database.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [reason]);
      const prior = await database.query<{ id: string }>(
        `select voucher.id from voucher.timeline event join voucher.voucher voucher on voucher.id=event.voucher_id
        join voucher.holder holder on holder.id=voucher.holder_id where event.reason=$1 and event.actor_id='system:fulfillment'
        and voucher.scope_id=$2 and holder.member_id=$3 order by voucher.id`,
        [reason, input.scope, input.member]
      );
      if (prior.rows.length > item.quantity) throw new Error('VOUCHER_FULFILLMENT_QUANTITY_CONFLICT');
      const needed = item.quantity - prior.rows.length;
      const selected = needed === 0 ? [] : (await database.query<VoucherRow & { activation: string }>(
        `select ${VOUCHER_FIELDS},terms.activation from voucher.voucher voucher ${VOUCHER_TERMS}
        join voucher.product product on product.id=voucher.product_id and product.scope_id=voucher.scope_id
        where voucher.product_id=$1 and voucher.scope_id=$2 and product.state='enabled' and voucher.holder_id is null
        and voucher.state in('available','allocated') and voucher.expires_at>clock_timestamp()
        order by voucher.expires_at,voucher.id for update of voucher skip locked limit $3`,
        [item.product, input.scope, needed]
      )).rows;
      if (selected.length !== needed) throw new DomainError('VOUCHER_STOCK_INSUFFICIENT');
      for (const voucher of selected) {
        const holder = `holder:${randomUUID()}`;
        const now = new Date();
        const state = voucher.activation === 'automatic' && new Date(voucher.starts_at) <= now ? 'active' : 'bound';
        await database.query(
          `insert into voucher.holder(id,scope_id,voucher_id,member_id,state,version,bound_at,released_at) values($1,$2,$3,$4,'bound',1,$5,null)`,
          [holder, input.scope, voucher.id, input.member, now]
        );
        const changed = await database.query(
          `update voucher.voucher set holder_id=$3,state=$4,version=version+1 where id=$1 and scope_id=$2 and holder_id is null and version=$5 returning id`,
          [voucher.id, input.scope, holder, state, voucher.version]
        );
        if (!changed.rows[0]) throw new Error('VOUCHER_FULFILLMENT_QUANTITY_CONFLICT');
        await timeline(database, voucher.id, input.scope, voucher.state, state, reason, 'system:fulfillment', now);
      }
      issued.push(...prior.rows.map(({ id }) => id), ...selected.map(({ id }) => id));
    }
    const vouchers = Object.freeze([...issued].sort());
    if (vouchers.length !== items.reduce((sum, item) => sum + item.quantity, 0)) throw new Error('VOUCHER_FULFILLMENT_QUANTITY_CONFLICT');
    return Object.freeze({ reference: `voucherissue:${input.fulfillment}`, vouchers });
  }

  private accounting(): VoucherAccountingPort {
    if (!this.finance) throw new Error('VOUCHER_FINANCE_DEPENDENCY_REQUIRED');
    return this.finance;
  }

  private redemptions(): VoucherRedemptionWriter {
    if (!this.organizations) throw new Error('VOUCHER_ORGANIZATION_DEPENDENCY_REQUIRED');
    return new VoucherRedemptionWriter(this.accounting(), this.organizations, this.transactions);
  }
}

interface VoucherRow {
  readonly id: string;
  readonly scope_id: string;
  readonly product_id: string;
  readonly credential_id: string;
  readonly holder_id: string | null;
  readonly initial_minor: number;
  readonly remaining_minor: number;
  readonly currency: string;
  readonly state: string;
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly version: number;
}

interface HoldRow {
  readonly id: string;
  readonly scope_id: string;
  readonly voucher_id: string;
  readonly owner_id: string;
  readonly amount_minor: number;
  readonly state: string;
  readonly expires_at: Date;
}
