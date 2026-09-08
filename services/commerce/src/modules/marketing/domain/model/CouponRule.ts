import { DomainError } from '../../../../platform/error/DomainError';

export interface CouponRuleSnapshot {
  readonly perMemberLimit: number;
  readonly totalLimit: number;
  readonly claimStartsAt: string;
  readonly claimEndsAt: string;
}

export class CouponRule {
  private constructor(private readonly value: CouponRuleSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(value: CouponRuleSnapshot): CouponRule {
    return new CouponRule(
      Object.freeze({
        ...value,
        claimStartsAt: iso(value.claimStartsAt),
        claimEndsAt: iso(value.claimEndsAt),
      })
    );
  }

  claimable(memberClaims: number, totalClaims: number, at: Date): boolean {
    return memberClaims < this.value.perMemberLimit && totalClaims < this.value.totalLimit && at.getTime() >= Date.parse(this.value.claimStartsAt) && at.getTime() < Date.parse(this.value.claimEndsAt);
  }

  snapshot(): CouponRuleSnapshot {
    return this.value;
  }
}

function validate(value: CouponRuleSnapshot): void {
  if (!Number.isSafeInteger(value.perMemberLimit) || value.perMemberLimit < 1 || value.perMemberLimit > 10_000) invalid('perMemberLimit');
  if (!Number.isSafeInteger(value.totalLimit) || value.totalLimit < value.perMemberLimit) invalid('totalLimit');
  if (Date.parse(value.claimEndsAt) <= Date.parse(value.claimStartsAt)) invalid('claimPeriod');
}
function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid('claimPeriod');
  return parsed.toISOString();
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field: `coupon.${field}` });
}
