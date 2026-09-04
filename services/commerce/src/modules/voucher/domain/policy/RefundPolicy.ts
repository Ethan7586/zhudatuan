import { DomainError } from '../../../../foundation/domain/DomainError';
export class RefundPolicy {
  validate(original: number, refunded: number, requested: number): void {
    if (![original, refunded, requested].every(Number.isSafeInteger) || original <= 0 || refunded < 0 || requested <= 0 || refunded + requested > original) throw new DomainError('VOUCHER_REFUND_EXCEEDS_REDEMPTION');
  }
}
