import { DomainError } from '../../../../foundation/domain/DomainError';

export const VOUCHER_STATES = ['inactive', 'active', 'held', 'redeemed', 'reversed', 'disabled', 'expired', 'void'] as const;
export type VoucherState = (typeof VOUCHER_STATES)[number];

export class VoucherPolicy {
  assertTransition(current: VoucherState, next: VoucherState): void {
    const allowed: Readonly<Record<VoucherState, readonly VoucherState[]>> = {
      inactive: ['active', 'expired', 'void'],
      active: ['held', 'disabled', 'redeemed', 'expired', 'void'],
      held: ['active', 'redeemed', 'expired'],
      redeemed: ['reversed'],
      reversed: [],
      disabled: ['expired', 'void'],
      expired: [],
      void: [],
    };
    if (!allowed[current].includes(next)) throw new DomainError('VOUCHER_STATE_INVALID', { current, next });
  }
}

export function voucherState(value: string): VoucherState {
  if (!(VOUCHER_STATES as readonly string[]).includes(value)) throw new DomainError('VOUCHER_STATE_INVALID', { value });
  return value as VoucherState;
}
