import { DomainError } from '../../../../foundation/domain/DomainError';
export interface VoucherRefundValue { readonly id: string; readonly redemption: string; readonly amountMinor: number; readonly reason: string; readonly ruleVersion: number; }
export class VoucherRefund {
  constructor(readonly value: VoucherRefundValue) {
    if (!value.id || !value.redemption || !Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0 || value.reason.trim().length < 2 || !Number.isSafeInteger(value.ruleVersion) || value.ruleVersion < 1) throw new DomainError('VALIDATION_FAILED');
  }
}
