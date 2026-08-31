import { ReferralRate } from '../value/ReferralRate';

export interface CommissionLine {
  readonly id: string;
  readonly amountMinor: bigint;
}

export class CommissionPolicy {
  allocate(lines: readonly CommissionLine[], distributableMinor: bigint, rateBasisPoints: number): ReadonlyMap<string, bigint> {
    validateLines(lines);
    const total = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
    if (distributableMinor < 0n || distributableMinor > total) throw new Error('REFERRAL_BASE_AMOUNT_INVALID');
    const commission = new ReferralRate(rateBasisPoints).apply(distributableMinor);
    if (total === 0n || commission === 0n) return new Map(lines.map(({ id }) => [id, 0n]));
    const shares = lines.map((line) => ({ id: line.id, value: (commission * line.amountMinor) / total, remainder: (commission * line.amountMinor) % total }));
    let remainder = commission - shares.reduce((sum, share) => sum + share.value, 0n);
    shares.sort((left, right) => (left.remainder === right.remainder ? left.id.localeCompare(right.id) : left.remainder > right.remainder ? -1 : 1));
    return new Map(
      shares.map((share) => {
        const extra = remainder > 0n ? 1n : 0n;
        remainder -= extra;
        return [share.id, share.value + extra] as const;
      })
    );
  }

  cumulativeReversal(originalBaseMinor: bigint, refundedBaseMinor: bigint, rateBasisPoints: number): bigint {
    if (refundedBaseMinor < 0n || refundedBaseMinor > originalBaseMinor) throw new Error('REFERRAL_REFUND_AMOUNT_INVALID');
    const rate = new ReferralRate(rateBasisPoints);
    return rate.apply(originalBaseMinor) - rate.apply(originalBaseMinor - refundedBaseMinor);
  }
}

function validateLines(lines: readonly CommissionLine[]): void {
  const ids = new Set<string>();
  for (const line of lines) {
    if (!line.id || ids.has(line.id) || line.amountMinor < 0n) throw new Error('REFERRAL_LINE_INVALID');
    ids.add(line.id);
  }
}
