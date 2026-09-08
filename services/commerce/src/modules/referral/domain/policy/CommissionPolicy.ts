import { ReferralRate } from '../value/ReferralRate';

export interface CommissionLine {
  readonly id: string;
  readonly amountMinor: bigint;
}

export interface RefundPosition {
  readonly id: string;
  readonly lineId: string;
  readonly baseMinor: bigint;
  readonly refundedBaseMinor: bigint;
}

export type CommissionKind = 'commission' | 'reward';

export interface CommissionRecipient {
  readonly beneficiaryId: string;
  readonly kind: CommissionKind;
  readonly rateBasisPoints: number;
}

interface RecipientInput {
  readonly customerId: string;
  readonly directMemberId: string | null;
  readonly inviterMemberId: string | null;
  readonly rewardEnabled: boolean;
  readonly commissionBasisPoints: number;
  readonly rewardBasisPoints: number;
}

export class CommissionPolicy {
  recipients(input: RecipientInput): readonly CommissionRecipient[] {
    new ReferralRate(input.commissionBasisPoints);
    new ReferralRate(input.rewardBasisPoints);
    if (input.commissionBasisPoints + input.rewardBasisPoints > 10_000) throw new Error('REFERRAL_RATE_TOTAL_INVALID');
    if (!input.directMemberId || input.directMemberId === input.customerId) return [];
    const recipients: CommissionRecipient[] = [];
    if (input.commissionBasisPoints > 0) recipients.push({ beneficiaryId: input.directMemberId, kind: 'commission', rateBasisPoints: input.commissionBasisPoints });
    if (input.rewardEnabled && input.rewardBasisPoints > 0 && input.inviterMemberId && input.inviterMemberId !== input.directMemberId && input.inviterMemberId !== input.customerId) {
      recipients.push({ beneficiaryId: input.inviterMemberId, kind: 'reward', rateBasisPoints: input.rewardBasisPoints });
    }
    return Object.freeze(recipients.map((recipient) => Object.freeze(recipient)));
  }

  bases(lines: readonly CommissionLine[], excludedMinor: bigint): ReadonlyMap<string, bigint> {
    validateLines(lines);
    const total = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
    if (excludedMinor < 0n || excludedMinor > total) throw new Error('REFERRAL_BENEFIT_AMOUNT_INVALID');
    const excluded = exactShares(lines, excludedMinor);
    return new Map(lines.map((line) => [line.id, line.amountMinor - (excluded.get(line.id) ?? 0n)]));
  }

  refundDeltas(positions: readonly RefundPosition[], refundedMinor: bigint): ReadonlyMap<string, bigint> {
    const byLine = new Map<string, Readonly<{ baseMinor: bigint; refundedBaseMinor: bigint }>>();
    for (const position of positions) {
      if (!position.id || !position.lineId || position.baseMinor < 0n || position.refundedBaseMinor < 0n || position.refundedBaseMinor > position.baseMinor) throw new Error('REFERRAL_REFUND_AMOUNT_INVALID');
      const current = byLine.get(position.lineId);
      if (current && (current.baseMinor !== position.baseMinor || current.refundedBaseMinor !== position.refundedBaseMinor)) throw new Error('REFERRAL_COMMISSION_EVIDENCE_MISMATCH');
      byLine.set(position.lineId, { baseMinor: position.baseMinor, refundedBaseMinor: position.refundedBaseMinor });
    }
    const remaining = [...byLine].map(([id, value]) => ({ id, amountMinor: value.baseMinor - value.refundedBaseMinor }));
    const available = remaining.reduce((sum, line) => sum + line.amountMinor, 0n);
    const byLineDelta = this.allocate(remaining, minimum(refundedMinor, available), 10_000);
    return new Map(positions.map((position) => [position.id, byLineDelta.get(position.lineId) ?? 0n]));
  }

  allocate(lines: readonly CommissionLine[], distributableMinor: bigint, rateBasisPoints: number): ReadonlyMap<string, bigint> {
    validateLines(lines);
    const total = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
    if (distributableMinor < 0n || distributableMinor > total) throw new Error('REFERRAL_BASE_AMOUNT_INVALID');
    const commission = new ReferralRate(rateBasisPoints).apply(distributableMinor);
    if (total === 0n || commission === 0n) return new Map(lines.map(({ id }) => [id, 0n]));
    return exactShares(lines, commission);
  }
}

function exactShares(lines: readonly CommissionLine[], amount: bigint): ReadonlyMap<string, bigint> {
  const total = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
  if (amount === 0n || total === 0n) return new Map(lines.map(({ id }) => [id, 0n]));
  const shares = lines.map((line) => ({ id: line.id, value: (amount * line.amountMinor) / total, remainder: (amount * line.amountMinor) % total }));
  let remainder = amount - shares.reduce((sum, share) => sum + share.value, 0n);
  shares.sort((left, right) => (left.remainder === right.remainder ? left.id.localeCompare(right.id) : left.remainder > right.remainder ? -1 : 1));
  return new Map(
    shares.map((share) => {
      const extra = remainder > 0n ? 1n : 0n;
      remainder -= extra;
      return [share.id, share.value + extra] as const;
    })
  );
}

function validateLines(lines: readonly CommissionLine[]): void {
  const ids = new Set<string>();
  for (const line of lines) {
    if (!line.id || ids.has(line.id) || line.amountMinor < 0n) throw new Error('REFERRAL_LINE_INVALID');
    ids.add(line.id);
  }
}

function minimum(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}
