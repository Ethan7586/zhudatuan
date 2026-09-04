import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgTransactionalOutbox } from '../../../../adapter/database/PgTransactionalOutbox';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { VoucherAccountingPort } from '../../../finance/public';
import { Voucher } from '../../domain/model/Voucher';
import { VoucherRefund } from '../../domain/model/VoucherRefund';
import { Redemption } from '../../domain/model/Redemption';
import { refundEventId, voucherRefunded } from '../../domain/event/VoucherEvents';
import type { RedemptionContext } from '../../domain/value/RedemptionContext';
import { timeline } from './VoucherRedemptionWriter';

export interface RefundCommand {
  readonly context: WriteTransactionContext;
  readonly scope: string;
  readonly redemption: string;
  readonly amountMinor: number;
  readonly reason: string;
  readonly idempotency: string;
  readonly actor: string;
  readonly now: Date;
}

export class VoucherRefundWriter {
  private readonly outbox = new PgTransactionalOutbox();
  constructor(private readonly finance: VoucherAccountingPort, private readonly transactions = new PgTransactionAccess()) {}

  async refund(command: RefundCommand): Promise<string> {
    const database = this.transactions.database(command.context);
    const prior = await database.query<{ id: string; redemption_id: string; amount_minor: number }>(
      `select id,redemption_id,amount_minor::integer amount_minor from voucher.refund where scope_id=$1 and idempotency_key=$2`,
      [command.scope, command.idempotency]
    );
    if (prior.rows[0]) {
      if (prior.rows[0].redemption_id !== command.redemption || Number(prior.rows[0].amount_minor) !== command.amountMinor) {
        throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
      }
      return prior.rows[0].id;
    }
    const reference = (await database.query<{ voucher_id: string }>(`select voucher_id from voucher.redemption where id=$1 and scope_id=$2`,
      [command.redemption, command.scope])).rows[0];
    if (!reference) throw new DomainError('RESOURCE_NOT_FOUND');
    await database.query(`select id from voucher.voucher where id=$1 and scope_id=$2 for update`, [reference.voucher_id, command.scope]);
    const selected = await database.query<RefundSource>(
      `select redemption.voucher_id,redemption.currency,voucher.credential_id,voucher.product_id,voucher.holder_id,
      voucher.initial_minor,voucher.remaining_minor,voucher.state voucher_state,voucher.starts_at,voucher.expires_at,voucher.version,
      redemption.order_id,redemption.channel,redemption.store_id "store",redemption.reporting_scopes "scopes",redemption.timezone,
      redemption.hold_id,redemption.verification_id,redemption.amount_minor,redemption.refunded_minor,redemption.state redemption_state,redemption.version redemption_version
      from voucher.redemption redemption join voucher.voucher voucher on voucher.id=redemption.voucher_id and voucher.scope_id=redemption.scope_id
      where redemption.id=$1 and redemption.scope_id=$2 for update of redemption`,
      [command.redemption, command.scope]
    );
    const source = selected.rows[0];
    if (!source) throw new DomainError('RESOURCE_NOT_FOUND');
    new Redemption({ id: command.redemption, voucher: source.voucher_id, hold: source.hold_id, verification: source.verification_id,
      amountMinor: Number(source.amount_minor), refundedMinor: Number(source.refunded_minor), state: source.redemption_state, version: Number(source.redemption_version) }).refund(command.amountMinor);
    const aggregate = new Voucher({
      id: source.voucher_id,
      credential: source.credential_id,
      product: source.product_id,
      holder: source.holder_id,
      initialMinor: Number(source.initial_minor),
      remainingMinor: Number(source.remaining_minor),
      state: source.voucher_state,
      startsAt: new Date(source.starts_at),
      expiresAt: new Date(source.expires_at),
      version: Number(source.version),
    }).refund(command.amountMinor);
    const refund = new VoucherRefund({
      id: `refund:${randomUUID()}`,
      redemption: command.redemption,
      amountMinor: command.amountMinor,
      reason: command.reason,
      ruleVersion: 1,
    });
    const created = await database.query<{ id: string }>(
      `select (voucher.create_refund($1,$2,$3,$4,$5,$6,$7,$8)).id`,
      [refund.value.id, command.scope, command.redemption, command.amountMinor, command.reason, refund.value.ruleVersion, command.idempotency, command.now]
    );
    if (created.rows[0]?.id !== refund.value.id) throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
    const changed = await database.query(
      `update voucher.voucher set remaining_minor=$3,state=$4,version=$5 where id=$1 and scope_id=$2 and version=$6 returning id`,
      [source.voucher_id, command.scope, aggregate.value.remainingMinor, aggregate.value.state, aggregate.value.version, source.version]
    );
    if (changed.rows.length !== 1) throw new DomainError('VERSION_CONFLICT');
    await timeline(database, source.voucher_id, command.scope, source.voucher_state, aggregate.value.state, command.reason, command.actor, command.now);
    await this.outbox.append(command.context, voucherRefunded({ id: refundEventId(refund.value.id), scope: command.scope, voucher: source.voucher_id,
      redemption: command.redemption, refund: refund.value.id, ruleVersion: refund.value.ruleVersion, amountMinor: command.amountMinor, currency: source.currency,
      channel: source.channel, store: source.store, scopes: source.scopes, timezone: source.timezone, order: source.order_id,
      actor: command.actor, trace: command.context.trace, version: aggregate.value.version, occurredAt: command.now.toISOString() }));
    await this.finance.post(command.context, {
      scopeId: command.scope,
      source: { module: 'voucher', aggregate: 'refund', aggregateId: refund.value.id, event: 'voucher.refund', eventId: refundEventId(refund.value.id), leg: 'refund' },
      currency: source.currency,
      description: '卡券退款冲正',
      debit: { code: 'commerce.clearing', kind: 'income' },
      credit: { code: `voucher.product.${source.product_id}`, kind: 'liability' },
      amountMinor: command.amountMinor,
      occurredAt: command.now.toISOString(),
    });
    return created.rows[0].id;
  }
}

interface RefundSource extends RedemptionContext {
  readonly order_id: string | null;
  readonly hold_id: string | null;
  readonly verification_id: string;
  readonly amount_minor: number;
  readonly refunded_minor: number;
  readonly redemption_state: 'succeeded' | 'partiallyrefunded' | 'refunded';
  readonly redemption_version: number;
  readonly voucher_id: string;
  readonly currency: string;
  readonly credential_id: string;
  readonly product_id: string;
  readonly holder_id: string | null;
  readonly initial_minor: number;
  readonly remaining_minor: number;
  readonly voucher_state: 'generated' | 'available' | 'allocated' | 'bound' | 'active' | 'held' | 'redeemed' | 'disabled' | 'void' | 'reversed' | 'expired';
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly version: number;
}
