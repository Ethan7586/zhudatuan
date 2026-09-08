import { DomainError } from '../../../../platform/error/DomainError';

export interface IssueTermsValue {
  readonly product: string;
  readonly productVersion: number;
  readonly pool: string;
  readonly faceMinor: number;
  readonly currency: string;
  readonly qualification: string;
  readonly activation: 'automatic' | 'secret' | 'numbersecret';
  readonly startsAt: string;
  readonly expiresAt: string;
}

/** Economic and activation terms of an issuance, independent of future product revisions. */
export class IssueTerms {
  readonly value: IssueTermsValue;
  constructor(value: IssueTermsValue) {
    if (
      !value.product ||
      !value.pool ||
      !value.qualification ||
      !Number.isSafeInteger(value.productVersion) ||
      value.productVersion < 1 ||
      !Number.isSafeInteger(value.faceMinor) ||
      value.faceMinor <= 0 ||
      value.currency !== 'CNY' ||
      !['automatic', 'secret', 'numbersecret'].includes(value.activation) ||
      !Number.isFinite(Date.parse(value.startsAt)) ||
      !Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.expiresAt) <= Date.parse(value.startsAt)
    )
      throw new DomainError('VOUCHER_PRODUCT_INCOMPLETE');
    this.value = Object.freeze({ ...value });
  }

  amount(quantity: number): number {
    const amount = this.value.faceMinor * quantity;
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(amount)) throw new DomainError('VALIDATION_FAILED');
    return amount;
  }

  assertValidity(startsAt: Date, expiresAt: Date, now: Date): void {
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(expiresAt.getTime()) ||
      startsAt >= expiresAt ||
      expiresAt <= now ||
      startsAt.getTime() < Date.parse(this.value.startsAt) ||
      expiresAt.getTime() > Date.parse(this.value.expiresAt)
    )
      throw new DomainError('VOUCHER_PRODUCT_INCOMPLETE');
  }
}
