export type CommissionKind = 'commission' | 'reward';
export type CommissionState = 'pending' | 'settling' | 'settled' | 'reversed';
export type SettleTrigger = 'on_paid' | 'on_received';

export interface ReferralRecipientInput {
  readonly directMemberId: string | null;
  readonly inviterMemberId: string | null;
  readonly rewardEnabled: boolean;
  readonly commissionBps: number;
  readonly rewardBps: number;
}

export interface CommissionRecipient {
  readonly beneficiaryMemberId: string;
  readonly kind: CommissionKind;
  readonly rateBps: number;
}

export interface MinorLine {
  readonly id: string;
  readonly amountMinor: bigint;
}

export interface LineRefund {
  readonly lineId: string | null;
  readonly amountMinor: bigint;
}

const RATE_SCALE = 10_000n;

/** Returns the direct recipient and, at most, that member's immediate inviter. */
export function commissionRecipients(input: ReferralRecipientInput): readonly CommissionRecipient[] {
  assertRate(input.commissionBps);
  assertRate(input.rewardBps);
  if (!input.directMemberId) return [];
  const recipients: CommissionRecipient[] = [];
  if (input.commissionBps > 0) recipients.push({ beneficiaryMemberId: input.directMemberId, kind: 'commission', rateBps: input.commissionBps });
  if (
    input.rewardEnabled &&
    input.rewardBps > 0 &&
    input.inviterMemberId &&
    input.inviterMemberId !== input.directMemberId
  ) {
    recipients.push({ beneficiaryMemberId: input.inviterMemberId, kind: 'reward', rateBps: input.rewardBps });
  }
  return recipients;
}

/** Removes the benefit-funded share from every line, flooring each line in minor units. */
export function commissionableBases(lines: readonly MinorLine[], benefitMinor: bigint): readonly MinorLine[] {
  assertLines(lines);
  if (benefitMinor < 0n) throw new Error('REFERRAL_BENEFIT_AMOUNT_INVALID');
  const total = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
  if (benefitMinor > total) throw new Error('REFERRAL_BENEFIT_AMOUNT_INVALID');
  if (total === 0n) return lines.map((line) => ({ id: line.id, amountMinor: 0n }));
  const included = total - benefitMinor;
  return lines.map((line) => ({ id: line.id, amountMinor: (line.amountMinor * included) / total }));
}

export function commissionAmount(baseMinor: bigint, rateBps: number): bigint {
  if (baseMinor < 0n) throw new Error('REFERRAL_BASE_AMOUNT_INVALID');
  assertRate(rateBps);
  return (baseMinor * BigInt(rateBps)) / RATE_SCALE;
}

/**
 * Converts cumulative successful refunds into per-line refunded bases. Line-specific
 * amounts are applied first; order-wide amounts use an exact deterministic split.
 */
export function cumulativeRefundBases(lines: readonly MinorLine[], refunds: readonly LineRefund[]): ReadonlyMap<string, bigint> {
  assertLines(lines);
  for (const refund of refunds) if (refund.amountMinor < 0n) throw new Error('REFERRAL_REFUND_AMOUNT_INVALID');

  const capacity = new Map(lines.map((line) => [line.id, line.amountMinor]));
  const allocated = new Map(lines.map((line) => [line.id, 0n]));
  let orderWide = 0n;
  for (const refund of refunds) {
    if (refund.lineId === null) {
      orderWide += refund.amountMinor;
      continue;
    }
    const maximum = capacity.get(refund.lineId);
    if (maximum === undefined) throw new Error('REFERRAL_REFUND_LINE_INVALID');
    const current = allocated.get(refund.lineId) ?? 0n;
    allocated.set(refund.lineId, minimum(maximum, current + refund.amountMinor));
  }

  const remaining = lines.map((line) => ({ id: line.id, amountMinor: line.amountMinor - (allocated.get(line.id) ?? 0n) }));
  const available = remaining.reduce((sum, line) => sum + line.amountMinor, 0n);
  const split = exactProRata(remaining, minimum(orderWide, available));
  for (const [line, amount] of split) allocated.set(line, (allocated.get(line) ?? 0n) + amount);
  return allocated;
}

/** Recomputes from the remaining base so cumulative partial refunds cannot drift. */
export function cumulativeReversalAmount(baseMinor: bigint, rateBps: number, refundedBaseMinor: bigint): bigint {
  if (refundedBaseMinor < 0n || refundedBaseMinor > baseMinor) throw new Error('REFERRAL_REFUND_AMOUNT_INVALID');
  const original = commissionAmount(baseMinor, rateBps);
  const remaining = commissionAmount(baseMinor - refundedBaseMinor, rateBps);
  return original - remaining;
}

export function entersSettling(trigger: SettleTrigger, event: 'paid' | 'received'): boolean {
  return (trigger === 'on_paid' && event === 'paid') || (trigger === 'on_received' && event === 'received');
}

export function stateAfterReversal(state: CommissionState, amountMinor: bigint, reversedMinor: bigint): CommissionState {
  if (amountMinor < 0n || reversedMinor < 0n || reversedMinor > amountMinor) throw new Error('REFERRAL_REVERSAL_AMOUNT_INVALID');
  return reversedMinor === amountMinor ? 'reversed' : state;
}

function exactProRata(lines: readonly MinorLine[], amount: bigint): ReadonlyMap<string, bigint> {
  const total = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
  const allocation = new Map(lines.map((line) => [line.id, 0n]));
  if (amount === 0n || total === 0n) return allocation;

  const shares = lines.map((line) => ({
    id: line.id,
    quotient: (amount * line.amountMinor) / total,
    remainder: (amount * line.amountMinor) % total,
  }));
  let left = amount - shares.reduce((sum, share) => sum + share.quotient, 0n);
  shares.sort((leftShare, rightShare) => {
    if (leftShare.remainder === rightShare.remainder) return leftShare.id.localeCompare(rightShare.id);
    return leftShare.remainder > rightShare.remainder ? -1 : 1;
  });
  for (const share of shares) {
    const extra = left > 0n ? 1n : 0n;
    allocation.set(share.id, share.quotient + extra);
    left -= extra;
  }
  return allocation;
}

function assertLines(lines: readonly MinorLine[]): void {
  const ids = new Set<string>();
  for (const line of lines) {
    if (!line.id || ids.has(line.id) || line.amountMinor < 0n) throw new Error('REFERRAL_LINE_INVALID');
    ids.add(line.id);
  }
}

function assertRate(rateBps: number): void {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps > 10_000) throw new Error('REFERRAL_RATE_INVALID');
}

function minimum(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}
