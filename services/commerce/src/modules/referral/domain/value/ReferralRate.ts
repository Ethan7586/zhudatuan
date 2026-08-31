import { DomainError } from '../../../../foundation/domain/DomainError';

const SCALE = 10_000n;

export class ReferralRate {
  readonly basisPoints: number;

  constructor(basisPoints: number) {
    if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > Number(SCALE)) throw new DomainError('REFERRAL_RATE_INVALID');
    this.basisPoints = basisPoints;
    Object.freeze(this);
  }

  apply(amountMinor: bigint): bigint {
    if (amountMinor < 0n) throw new Error('REFERRAL_BASE_AMOUNT_INVALID');
    return (amountMinor * BigInt(this.basisPoints)) / SCALE;
  }
}
