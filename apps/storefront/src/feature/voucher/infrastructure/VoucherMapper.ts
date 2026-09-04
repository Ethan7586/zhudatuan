import type { OperationOutputFor } from '@shop/contract';
import type { VoucherActivity } from '../model/VoucherActivity';
import type { Voucher } from '../model/Voucher';

type VoucherDto = OperationOutputFor<'voucher.vouchers.get'>;
type TimelineDto = OperationOutputFor<'voucher.vouchers.timeline'>['items'][number];

export function mapVoucher(value: VoucherDto): Voucher {
  return Object.freeze({
    id: value.id,
    productId: value.product,
    productName: value.productName,
    numberMasked: value.numberMasked,
    initialMinor: value.initialMinor,
    remainingMinor: value.remainingMinor,
    currency: value.currency,
    state: value.state,
    startsAt: value.validity.startsAt,
    expiresAt: value.validity.expiresAt,
    version: value.version,
  });
}

export function mapActivity(value: TimelineDto): VoucherActivity {
  return Object.freeze({
    sequence: value.sequence,
    previous: value.previous,
    next: value.next,
    reason: value.reason,
    occurredAt: value.occurredAt,
    redemption: value.redemption ? Object.freeze({ ...value.redemption }) : null,
  });
}
