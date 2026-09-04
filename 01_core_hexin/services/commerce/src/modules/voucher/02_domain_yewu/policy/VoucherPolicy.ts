import { DomainError } from '../../../../foundation/domain/DomainError';

export const VOUCHER_STATES = ['created', 'active', 'bound', 'reserved', 'disabled', 'redeemed', 'expired', 'void'] as const;
export type VoucherState = (typeof VOUCHER_STATES)[number];

export class VoucherPolicy {
  assertTransition(current: VoucherState, next: VoucherState): void {
    const allowed: Readonly<Record<VoucherState, readonly VoucherState[]>> = {
      created: ['active', 'bound', 'expired', 'void'], active: ['bound', 'reserved', 'disabled', 'redeemed', 'expired', 'void'],
      bound: ['active', 'reserved', 'disabled', 'redeemed', 'expired', 'void'], reserved: ['active', 'bound', 'redeemed', 'expired'],
      disabled: ['active', 'bound', 'expired', 'void'], redeemed: [], expired: [], void: [],
    };
    if (!allowed[current].includes(next)) throw new DomainError('VOUCHER_STATE_INVALID', { current, next });
  }
}

export function voucherState(value: string): VoucherState {
  if (!(VOUCHER_STATES as readonly string[]).includes(value)) throw new DomainError('VOUCHER_STATE_INVALID', { value });
  return value as VoucherState;
}
