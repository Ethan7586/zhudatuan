import { randomUUID } from 'node:crypto';
import type { OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import { VOUCHER_TERMS } from './IssueTerms';
import type { MemberAccessPort } from '../../../access/public';
import type { VoucherAccountingPort } from '../../../finance/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ActivationLookup, ActivationRate } from '../../application/port/ActivationRate';
import { OperationRejection } from '../../../../pipeline/OperationRejection';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherRepository } from '../../application/port/VoucherRepository';
import { Voucher } from '../../domain/model/Voucher';
import { Holder, type HolderValue } from '../../domain/model/Holder';
import { body, cursor, expected, limit, normalize, one, page, path, REDEMPTION, requiredIdempotency, text, VOUCHER, VOUCHER_FIELDS, write } from './VoucherSupport';
import { VoucherRefundWriter } from './VoucherRefundWriter';
import { timeline, VoucherRedemptionWriter } from './VoucherRedemptionWriter';

import { activationFailure, aggregate, lock, ownOnly, type VoucherRow } from './VoucherRecord';
export class PgVoucherRepository implements VoucherRepository {
  private readonly redemptions: VoucherRedemptionWriter;
  constructor(
    private readonly rates: ActivationRate,
    private readonly members: Pick<MemberAccessPort, 'activeIn'>,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants' | 'scope'>,
    private readonly finance: VoucherAccountingPort,
    private readonly transactions = new PgTransactionAccess()
  ) {
    this.redemptions = new VoucherRedemptionWriter(finance, organizations, transactions);
  }
  activateSecret(call: Parameters<VoucherRepository['activateSecret']>[0], lookup: ActivationLookup) {
    return this.activate(call, lookup, 'voucher.activations.secret');
  }
  activateNumber(call: Parameters<VoucherRepository['activateNumber']>[0], lookup: ActivationLookup) {
    return this.activate(call, lookup, 'voucher.activations.numbersecret');
  }
  async bind(call: Parameters<VoucherRepository['bind']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'voucherid');
    const member = text(body(call).member, 'member');
    if (!(await this.members.activeIn(call.context.transaction, member, await this.organizations.descendants(call.context.transaction, call.scope)))) throw new DomainError('SCOPE_DENIED');
    const row = await lock(database, id, call.scope);
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const holder = `holder:${randomUUID()}`;
    const binding = new Holder({ id: holder, voucher: id, member, state: 'bound', version: 1 });
    const changed = aggregate(row).bind(binding.value.id);
    await database.query(`insert into voucher.holder(id,scope_id,voucher_id,member_id,state,version,bound_at,released_at) values($1,$2,$3,$4,$5,$6,$7,null)`, [
      binding.value.id,
      call.scope,
      id,
      binding.value.member,
      binding.value.state,
      binding.value.version,
      call.now,
    ]);
    await database.query(`update voucher.voucher set holder_id=$3,state=$4,version=$5 where id=$1 and scope_id=$2`, [id, call.scope, holder, changed.value.state, changed.value.version]);
    await timeline(database, id, call.scope, row.state, changed.value.state, text(body(call).reason, 'reason'), call.actor, call.now);
    return this.readVoucher(call, id, 200, 'voucher.vouchers.bind');
  }
  async unbind(call: Parameters<VoucherRepository['unbind']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'voucherid');
    const row = await lock(database, id, call.scope);
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const changed = aggregate(row).unbind();
    const found = await database.query<HolderValue>(`select id,voucher_id voucher,member_id member,state,version::integer from voucher.holder where id=$1 and scope_id=$2 and voucher_id=$3 for update`, [row.holder_id, call.scope, id]);
    if (!found.rows[0]) throw new DomainError('VOUCHER_STATE_INVALID');
    const released = new Holder(found.rows[0]).release();
    await database.query(`update voucher.holder set state=$3,version=$4,released_at=$5 where id=$1 and scope_id=$2 and state='bound'`, [released.value.id, call.scope, released.value.state, released.value.version, call.now]);
    await database.query(`update voucher.voucher set holder_id=null,state=$3,version=$4 where id=$1 and scope_id=$2`, [id, call.scope, changed.value.state, changed.value.version]);
    await timeline(database, id, call.scope, row.state, changed.value.state, text(body(call).reason, 'reason'), call.actor, call.now);
    return this.readVoucher(call, id, 200, 'voucher.vouchers.unbind');
  }
  get(call: Parameters<VoucherRepository['get']>[0]) {
    return this.readVoucher(call, path(call, 'voucherid'), 200, 'voucher.vouchers.get');
  }
  async number(call: Parameters<VoucherRepository['number']>[0], fingerprint: string) {
    const database = this.transactions.database(call.context.transaction);
    const row = await database.query(`${VOUCHER} where voucher.scope_id=$1 and voucher.number_fingerprint=$2 and ($3::boolean=false or holder.member_id=$4)`, [call.scope, fingerprint, ownOnly(call.target), call.member]);
    return one<'voucher.vouchers.getbynumber'>(200, row.rows[0]);
  }
  async timeline(call: Parameters<VoucherRepository['timeline']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const voucher = path(call, 'voucherid');
    await this.visible(database, call, voucher);
    const filter = (call.input as { query?: Readonly<Record<string, unknown>> }).query ?? {};
    const fetch = limit(filter.limit);
    const after = cursor(filter.cursor);
    if (after !== null && !/^[1-9][0-9]{0,15}$/.test(after)) throw new DomainError('VALIDATION_FAILED', { field: 'cursor' });
    const rows = await database.query(
      `select event.sequence::integer,event.previous_state previous,event.next_state next,event.reason,
      case when $5::boolean then case when event.actor_id like 'system:%' then 'system' else 'operator' end else event.actor_id end actor,
      event.occurred_at as "occurredAt",case when redemption.id is null then null else jsonb_build_object(
        'id',redemption.id,'order',redemption.order_id,'amountMinor',redemption.amount_minor,'refundedMinor',redemption.refunded_minor,
        'currency',redemption.currency,'state',redemption.state,'redeemedAt',redemption.redeemed_at) end redemption
      from voucher.timeline event left join voucher.redemption redemption on redemption.id=event.redemption_id
        and redemption.scope_id=event.scope_id and redemption.voucher_id=event.voucher_id
      where event.voucher_id=$1 and event.scope_id=$2 and ($3::text is null or event.sequence>$3::bigint) order by event.sequence limit $4`,
      [voucher, call.scope, after, fetch + 1, ownOnly(call.target)]
    );
    return page<'voucher.vouchers.timeline'>(rows.rows, fetch, 'sequence');
  }
  async quote(call: Parameters<VoucherRepository['quote']>[0]) {
    const value = body(call);
    const id = text(value.voucher, 'voucher');
    const amount = Number(value.amountMinor);
    const database = this.transactions.database(call.context.transaction);
    await this.visible(database, call, id);
    const row = await database.query(`${VOUCHER} where voucher.id=$1 and voucher.scope_id=$2 and voucher.state='active' and voucher.remaining_minor>=$3 and voucher.starts_at<=$4 and voucher.expires_at>$4`, [
      id,
      call.scope,
      amount,
      call.now,
    ]);
    if (!row.rows[0]) throw new DomainError('VOUCHER_NOT_REDEEMABLE');
    const voucher = normalize(row.rows[0]) as OperationOutputFor<'voucher.vouchers.get'>;
    return { status: 200, body: { voucher, amountMinor: amount, remainingMinor: Number(voucher.remainingMinor) - amount, expiresAt: voucher.validity.expiresAt } };
  }
  async redeem(call: Parameters<VoucherRepository['redeem']>[0]) {
    const value = body(call);
    const redeemed = await this.redemptions.redeem({
      context: write(call),
      scope: call.scope,
      voucher: text(value.voucher, 'voucher'),
      hold: text(value.hold, 'hold'),
      verification: text(value.verification, 'verification'),
      order: typeof value.order === 'string' ? value.order : null,
      amountMinor: Number(value.amountMinor),
      idempotency: requiredIdempotency(call),
      actor: call.actor,
      now: call.now,
    });
    return { status: 201, body: redeemed };
  }
  async refund(call: Parameters<VoucherRepository['refund']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const redemption = path(call, 'redemptionid');
    const value = body(call);
    const id = await new VoucherRefundWriter(this.finance, this.transactions).refund({
      context: write(call),
      scope: call.scope,
      redemption,
      amountMinor: Number(value.amountMinor),
      reason: text(value.reason, 'reason'),
      idempotency: requiredIdempotency(call),
      actor: call.actor,
      now: call.now,
    });
    const created = await database.query(
      `select id,redemption_id redemption,amount_minor::integer as "amountMinor",currency,reason,state,
      rule_version::integer as "ruleVersion",created_at as "createdAt" from voucher.refund where id=$1 and scope_id=$2`,
      [id, call.scope]
    );
    return one<'voucher.refunds.create'>(201, created.rows[0]);
  }
  async redemption(call: Parameters<VoucherRepository['redemption']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'redemptionid');
    const row = await database.query(
      `${REDEMPTION} join voucher.voucher voucheraccess on voucheraccess.id=redemption.voucher_id left join voucher.holder holder on holder.id=voucheraccess.holder_id and holder.state='bound' where redemption.id=$1 and redemption.scope_id=$2 and ($3::boolean=false or holder.member_id=$4)`,
      [id, call.scope, ownOnly(call.target), call.member]
    );
    return one<'voucher.redemptions.get'>(200, row.rows[0]);
  }
  private async activate(
    call: Parameters<VoucherRepository['activateSecret']>[0] | Parameters<VoucherRepository['activateNumber']>[0],
    lookup: ActivationLookup,
    operation: 'voucher.activations.secret' | 'voucher.activations.numbersecret'
  ) {
    const attempt = `activationattempt:${randomUUID()}`;
    const allowed = await this.rates.consume(write(call), { id: attempt, scope: call.scope, actor: call.actor, fingerprint: lookup.secretFingerprint, attemptedAt: call.now });
    if (!allowed) return activationFailure('RATE_LIMITED');
    const database = this.transactions.database(call.context.transaction);
    const selected = await database.query<VoucherRow>(
      `select ${VOUCHER_FIELDS} from voucher.voucher voucher ${VOUCHER_TERMS}
      left join voucher.holder holder on holder.id=voucher.holder_id and holder.state='bound'
      where voucher.scope_id=$1 and issuedcredential.secret_fingerprint=$2 and ($3::text is null or issuedcredential.number_fingerprint=$3)
      and terms.activation=$4 and ($5::boolean=false or voucher.holder_id is null or holder.member_id=$6)
      for update of voucher`,
      [call.scope, lookup.secretFingerprint, lookup.numberFingerprint, operation === 'voucher.activations.numbersecret' ? 'numbersecret' : 'secret', ownOnly(call.target), call.member]
    );
    const row = selected.rows[0];
    if (!row) return activationFailure('VOUCHER_SECRET_INVALID');
    let changed: Voucher;
    const holder = ownOnly(call.target) && row.holder_id === null ? `holder:${randomUUID()}` : null;
    try {
      const source = aggregate(row);
      changed = source.activate(call.now, holder ?? undefined);
    } catch (cause) {
      if (cause instanceof DomainError && cause.code === 'VOUCHER_STATE_INVALID') return activationFailure('VOUCHER_SECRET_INVALID');
      throw cause;
    }
    if (holder)
      await database.query(
        `insert into voucher.holder(id,scope_id,voucher_id,member_id,state,version,bound_at,released_at)
      values($1,$2,$3,$4,'bound',1,$5,null)`,
        [holder, call.scope, row.id, call.member, call.now]
      );
    await database.query(`update voucher.voucher set state=$3,version=$4,holder_id=$5 where id=$1 and scope_id=$2`, [row.id, call.scope, changed.value.state, changed.value.version, changed.value.holder]);
    await timeline(database, row.id, call.scope, row.state, changed.value.state, 'activation', call.actor, call.now);
    await database.query(`update voucher.activationattempt set accepted=true where id=$1`, [attempt]);
    return this.readVoucher(call, row.id, 200, operation);
  }
  private async readVoucher(
    call: Parameters<VoucherRepository[keyof VoucherRepository]>[0],
    id: string,
    status: number,
    operation: 'voucher.activations.secret' | 'voucher.activations.numbersecret' | 'voucher.vouchers.bind' | 'voucher.vouchers.unbind' | 'voucher.vouchers.get'
  ) {
    const database = this.transactions.database(call.context.transaction);
    const row = await database.query(`${VOUCHER} where voucher.id=$1 and voucher.scope_id=$2 and ($3::boolean=false or holder.member_id=$4)`, [id, call.scope, ownOnly(call.target), call.member]);
    return one<typeof operation>(status, row.rows[0]);
  }
  private async visible(database: ReturnType<PgTransactionAccess['database']>, call: Parameters<VoucherRepository[keyof VoucherRepository]>[0], id: string) {
    const row = await database.query(
      `select 1 from voucher.voucher voucher left join voucher.holder holder on holder.id=voucher.holder_id and holder.state='bound' where voucher.id=$1 and voucher.scope_id=$2 and ($3::boolean=false or holder.member_id=$4)`,
      [id, call.scope, ownOnly(call.target), call.member]
    );
    if (!row.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
  }
}
