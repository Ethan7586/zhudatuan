import type { Redemption, VoucherCenter } from '../model/Redemption';
import type { Voucher } from '../model/Voucher';
import { nullableText } from '../../../shared/format/Text';

type RecordValue = Readonly<Record<string, unknown>>;

export function mapVoucherCenter(bindings: readonly RecordValue[], redemptions: readonly RecordValue[]): VoucherCenter {
  return Object.freeze({ vouchers: Object.freeze(bindings.map(mapVoucher)), redemptions: Object.freeze(redemptions.map(mapRedemption)) });
}
function mapVoucher(value: RecordValue): Voucher {
  return Object.freeze({
    id: String(value.id),
    programId: String(value.program_id),
    name: String(value.name),
    initialMinor: Number(value.initial_minor),
    remainingMinor: Number(value.remaining_minor),
    state: String(value.state),
    expiresAt: String(value.expires_at),
    version: Number(value.version),
  });
}
function mapRedemption(value: RecordValue): Redemption {
  return Object.freeze({
    id: String(value.id),
    voucherId: String(value.voucher_id),
    orderId: nullableText(value.order_id),
    amountMinor: Number(value.amount_minor),
    redeemedAt: String(value.redeemed_at),
    reversedMinor: Number(value.reversed_minor),
    state: value.receipt_state as Redemption['state'],
  });
}
