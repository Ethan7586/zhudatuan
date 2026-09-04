import { randomUUID } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { TenderHold, type TenderHoldValue } from '../../domain/model/TenderHold';
import { Voucher, type VoucherValue } from '../../domain/model/Voucher';
import { HOLD, HOLD_FIELDS, normalize, VOUCHER_FIELDS } from './VoucherSupport';
import { timeline } from './VoucherRedemptionWriter';

interface TenderCommand {
  readonly context: WriteTransactionContext;
  readonly scope: string;
  readonly now: Date;
  readonly actor: string;
}
interface ReserveCommand extends TenderCommand {
  readonly voucher: string;
  readonly owner: string;
  readonly member: string | null;
  readonly amountMinor: number;
  readonly ttlSeconds: number;
  readonly idempotency: string;
}
interface ReleaseCommand extends TenderCommand {
  readonly hold: string;
  readonly reason: string;
  readonly ifActive?: boolean;
  readonly expiredOnly?: boolean;
  readonly expectedVersion?: number;
}

/** All writers lock Voucher before Hold, including payment and expiry jobs. */
export class VoucherTenderWriter {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async reserve(command: ReserveCommand): Promise<Readonly<{ created: boolean; hold: OperationOutputFor<'voucher.tenderholds.create'> }>> {
    if (!command.voucher || !command.owner || !command.scope || !command.idempotency ||
      !Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0 || !Number.isSafeInteger(command.ttlSeconds) || command.ttlSeconds <= 0) {
      throw new DomainError('VALIDATION_FAILED');
    }
    const database = this.transactions.database(command.context);
    const selected = await database.query<VoucherRow>(`select ${VOUCHER_FIELDS},holder.member_id from voucher.voucher voucher
      left join voucher.holder holder on holder.id=voucher.holder_id and holder.scope_id=voucher.scope_id and holder.state='bound'
      where voucher.id=$1 and voucher.scope_id=$2 for update of voucher`, [command.voucher, command.scope]);
    const row = selected.rows[0];
    if (!row || (command.member !== null && row.member_id !== command.member)) throw new DomainError('VOUCHER_NOT_USABLE');
    const prior = await database.query<HoldRow>(`select ${HOLD_FIELDS} from voucher.tenderhold hold where hold.scope_id=$1 and hold.idempotency_key=$2 for update`,
      [command.scope, command.idempotency]);
    if (prior.rows[0]) {
      const hold = prior.rows[0];
      if (hold.voucher_id !== command.voucher || hold.owner_id !== command.owner || Number(hold.amount_minor) !== command.amountMinor ||
        !['active', 'consumed'].includes(hold.state)) throw new DomainError('VOUCHER_HOLD_CONFLICT');
      if (hold.state === 'active' && new Date(hold.expires_at) <= command.now) throw new DomainError('VOUCHER_HOLD_EXPIRED');
      return { created: false, hold: await this.read(command, hold.id) };
    }
    if (new Date(row.starts_at) > command.now || new Date(row.expires_at) <= command.now || Number(row.remaining_minor) < command.amountMinor) {
      throw new DomainError('VOUCHER_NOT_USABLE');
    }
    const held = aggregate(row).hold();
    const id = `tenderhold:${randomUUID()}`;
    const ttl = Math.min(command.ttlSeconds, RUNTIME_LIMITS.voucherTender.holdTtlSeconds);
    const expiresAt = new Date(Math.min(command.now.getTime() + ttl * 1000, new Date(row.expires_at).getTime()));
    const hold = new TenderHold({ id, voucher: row.id, owner: command.owner, amountMinor: command.amountMinor,
      state: 'active', expiresAt, idempotency: command.idempotency, version: 1 });
    await database.query(`insert into voucher.tenderhold(id,scope_id,voucher_id,owner_id,amount_minor,state,expires_at,idempotency_key,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,'active',$6,$7,1,$8,$8)`,
    [id, command.scope, row.id, hold.value.owner, hold.value.amountMinor, expiresAt, command.idempotency, command.now]);
    await database.query(`update voucher.voucher set state=$3,version=$4 where id=$1 and scope_id=$2`,
      [row.id, command.scope, held.value.state, held.value.version]);
    await timeline(database, row.id, command.scope, row.state, held.value.state, 'tenderhold', command.actor, command.now);
    return { created: true, hold: await this.read(command, id) };
  }

  async release(command: ReleaseCommand): Promise<OperationOutputFor<'voucher.tenderholds.release'>> {
    const database = this.transactions.database(command.context);
    // Resolve the immutable parent without taking the child lock first.
    const reference = (await database.query<{ voucher_id: string }>(`select voucher_id from voucher.tenderhold where id=$1 and scope_id=$2`,
      [command.hold, command.scope])).rows[0];
    if (!reference) throw new DomainError('RESOURCE_NOT_FOUND');
    const row = (await database.query<VoucherRow>(`select ${VOUCHER_FIELDS} from voucher.voucher voucher where voucher.id=$1 and voucher.scope_id=$2 for update`,
      [reference.voucher_id, command.scope])).rows[0];
    const source = (await database.query<HoldRow>(`select ${HOLD_FIELDS} from voucher.tenderhold hold where hold.id=$1 and hold.voucher_id=$2 and hold.scope_id=$3 for update`,
      [command.hold, reference.voucher_id, command.scope])).rows[0];
    if (!row || !source) throw new DomainError('RESOURCE_NOT_FOUND');
    if (source.state === 'released' || source.state === 'expired' || (command.ifActive && source.state !== 'active') ||
      (command.expiredOnly && new Date(source.expires_at) > command.now)) return this.read(command, source.id);
    if (command.expectedVersion !== undefined && Number(source.version) !== command.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const released = new TenderHold({ id: source.id, voucher: source.voucher_id, owner: source.owner_id,
      amountMinor: Number(source.amount_minor), state: source.state, expiresAt: new Date(source.expires_at),
      idempotency: source.idempotency_key, version: Number(source.version) }).release(command.now);
    const restored = aggregate(row).release(command.now);
    await database.query(`update voucher.tenderhold set state=$3,version=$4 where id=$1 and scope_id=$2`,
      [source.id, command.scope, released.value.state, released.value.version]);
    await database.query(`update voucher.voucher set state=$3,version=$4 where id=$1 and scope_id=$2`,
      [row.id, command.scope, restored.value.state, restored.value.version]);
    await timeline(database, row.id, command.scope, row.state, restored.value.state, command.reason, command.actor, command.now);
    return this.read(command, source.id);
  }

  private async read(command: TenderCommand, id: string): Promise<OperationOutputFor<'voucher.tenderholds.create'>> {
    const row = (await this.transactions.database(command.context).query(`${HOLD} where hold.id=$1 and hold.scope_id=$2`, [id, command.scope])).rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return normalize(row) as OperationOutputFor<'voucher.tenderholds.create'>;
  }
}

interface VoucherRow {
  readonly id: string;
  readonly credential_id: string;
  readonly product_id: string;
  readonly holder_id: string | null;
  readonly member_id: string | null;
  readonly initial_minor: number;
  readonly remaining_minor: number;
  readonly state: VoucherValue['state'];
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly version: number;
}
interface HoldRow {
  readonly id: string;
  readonly voucher_id: string;
  readonly owner_id: string;
  readonly amount_minor: number;
  readonly state: TenderHoldValue['state'];
  readonly expires_at: Date;
  readonly idempotency_key: string;
  readonly version: number;
}
function aggregate(row: VoucherRow): Voucher {
  return new Voucher({ id: row.id, credential: row.credential_id, product: row.product_id, holder: row.holder_id,
    initialMinor: Number(row.initial_minor), remainingMinor: Number(row.remaining_minor), state: row.state,
    startsAt: new Date(row.starts_at), expiresAt: new Date(row.expires_at), version: Number(row.version) });
}
