import { DomainError } from '../../../../platform/error/DomainError';
import { Validity } from '../value/Validity';

export interface ProductConfiguration {
  readonly customer: string;
  readonly name: string;
  readonly faceMinor: number;
  readonly currency: string;
  readonly qualification: string;
  readonly pool: string | null;
  readonly startsAt: Date;
  readonly expiresAt: Date;
  readonly activation: 'automatic' | 'secret' | 'numbersecret';
  readonly approvalRequired: boolean;
}
export class ProductPolicy {
  validate(value: ProductConfiguration): void {
    if (!value.customer || !value.name.trim() || !value.qualification || !Number.isSafeInteger(value.faceMinor) || value.faceMinor <= 0 || value.currency !== 'CNY') throw new DomainError('VOUCHER_PRODUCT_INCOMPLETE');
    new Validity(value.startsAt, value.expiresAt);
  }
  enable(value: ProductConfiguration & { readonly state: string }, now: Date): void {
    this.validate(value);
    if (!value.pool || !['draft', 'disabled'].includes(value.state) || value.expiresAt <= now) throw new DomainError('VOUCHER_PRODUCT_INCOMPLETE');
  }
}
