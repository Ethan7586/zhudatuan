import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { VoucherAccountingPort } from '../../../finance/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { TenderRepository } from '../../application/port/TenderRepository';
import { body, expected, HOLD_FIELDS, path, requiredIdempotency, text, write } from './VoucherSupport';
import { VoucherRedemptionWriter } from './VoucherRedemptionWriter';
import { VoucherTenderWriter } from './VoucherTenderWriter';

export class PgTenderRepository implements TenderRepository {
  private readonly redemptions: VoucherRedemptionWriter;
  private readonly tenders: VoucherTenderWriter;
  constructor(finance: VoucherAccountingPort, organizations: Pick<OrganizationReadPort, 'scope'>, private readonly transactions = new PgTransactionAccess()) {
    this.redemptions = new VoucherRedemptionWriter(finance, organizations, transactions);
    this.tenders = new VoucherTenderWriter(transactions);
  }
  async create(call: Parameters<TenderRepository['create']>[0]) {
    const value = body(call);
    const result = await this.tenders.reserve({ context: write(call), scope: call.scope, actor: call.actor, now: call.now,
      voucher: text(value.voucher, 'voucher'), owner: text(value.owner, 'owner'), amountMinor: Number(value.amountMinor),
      ttlSeconds: Number(value.ttlSeconds), idempotency: requiredIdempotency(call),
      member: ownOnly(call.target) ? text(call.member, 'member') : null });
    return { status: result.created ? 201 : 200, body: result.hold };
  }
  async consume(call: Parameters<TenderRepository['consume']>[0]) {
    const database = this.transactions.database(call.context.transaction); const id = path(call, 'holdid'); const selected = await database.query<HoldRow>(`select ${HOLD_FIELDS} from voucher.tenderhold hold where hold.id=$1 and hold.scope_id=$2`, [id, call.scope]); const hold = selected.rows[0]; if (!hold) throw new DomainError('RESOURCE_NOT_FOUND');
    const value = body(call); const redeemed = await this.redemptions.redeem({ context: write(call), scope: call.scope, voucher: hold.voucher_id, hold: id, expectedHoldVersion: expected(call), verification: text(value.verification,'verification'), order: typeof value.order === 'string' ? value.order : null, amountMinor: Number(hold.amount_minor), idempotency: requiredIdempotency(call), actor: call.actor, now: call.now }); return { status: 201, body: redeemed };
  }
  async release(call: Parameters<TenderRepository['release']>[0]) {
    return { status: 200, body: await this.tenders.release({ context: write(call), scope: call.scope, hold: path(call, 'holdid'),
      reason: text(body(call).reason, 'reason'), expectedVersion: expected(call), actor: call.actor, now: call.now }) };
  }
}
interface HoldRow { readonly id: string; readonly voucher_id: string; readonly owner_id: string; readonly amount_minor: number; readonly state: 'active' | 'consumed' | 'released' | 'expired'; readonly expires_at: Date; readonly idempotency_key: string; readonly version: number; }
function ownOnly(target: string) { return target === 'storefront' || target === 'miniapp'; }
