export class ReferralMoney {
  constructor(
    readonly amountMinor: bigint,
    readonly currency: string
  ) {
    if (amountMinor < 0n || !/^[A-Z]{3}$/.test(currency)) throw new Error('REFERRAL_MONEY_INVALID');
    Object.freeze(this);
  }

  add(other: ReferralMoney): ReferralMoney {
    this.sameCurrency(other);
    return new ReferralMoney(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: ReferralMoney): ReferralMoney {
    this.sameCurrency(other);
    if (other.amountMinor > this.amountMinor) throw new Error('REFERRAL_MONEY_NEGATIVE');
    return new ReferralMoney(this.amountMinor - other.amountMinor, this.currency);
  }

  private sameCurrency(other: ReferralMoney): void {
    if (other.currency !== this.currency) throw new Error('REFERRAL_CURRENCY_MISMATCH');
  }
}
