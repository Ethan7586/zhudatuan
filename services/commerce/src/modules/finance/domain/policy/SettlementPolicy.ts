import { DomainError } from '../../../../platform/error/DomainError';

export interface SettlementSplit {
  readonly grossMinor: number;
  readonly feeMinor: number;
  readonly netMinor: number;
  readonly invoiceBasis: 'gross' | 'net';
  readonly basisPoints: number;
}

export class SettlementPolicy {
  assertDecision(requester: string | null, approver: string, amountMinor: number): void {
    if (!requester || requester === approver) throw new DomainError('FINANCE_SETTLEMENT_SEPARATION_REQUIRED');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
  }

  split(grossMinor: number, rule: unknown): SettlementSplit {
    if (!Number.isSafeInteger(grossMinor) || grossMinor <= 0) throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
    const value = rule !== null && typeof rule === 'object' && !Array.isArray(rule) ? (rule as Readonly<Record<string, unknown>>) : {};
    const points = value.basisPoints === undefined ? 0 : value.basisPoints;
    const invoiceBasis = value.invoiceBasis === undefined ? 'gross' : value.invoiceBasis;
    if (!Number.isSafeInteger(points) || (points as number) < 0 || (points as number) > 5_000) {
      throw new DomainError('FINANCE_SETTLEMENT_FEE_INVALID');
    }
    if (invoiceBasis !== 'gross' && invoiceBasis !== 'net') throw new DomainError('FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID');
    const feeMinor = safeNumber((BigInt(grossMinor) * BigInt(points as number)) / 10_000n);
    const netMinor = grossMinor - feeMinor;
    if (!Number.isSafeInteger(feeMinor) || netMinor <= 0) throw new DomainError('FINANCE_SETTLEMENT_NET_INVALID');
    return Object.freeze({ grossMinor, feeMinor, netMinor, invoiceBasis, basisPoints: points as number });
  }

  allocate(totalMinor: number, weights: readonly Readonly<{ key: string; weight: number }>[]): readonly Readonly<{ key: string; amountMinor: number }>[] {
    if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0 || weights.length === 0 || weights.length > 10_000) {
      throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
    }
    const sorted = [...weights].sort((left, right) => left.key.localeCompare(right.key));
    if (new Set(sorted.map(({ key }) => key)).size !== sorted.length || sorted.some(({ key, weight }) => !key || !Number.isSafeInteger(weight) || weight <= 0)) {
      throw new DomainError('FINANCE_SETTLEMENT_FEE_INVALID');
    }
    const totalWeight = sorted.reduce((sum, { weight }) => sum + BigInt(weight), 0n);
    let allocated = 0;
    return Object.freeze(
      sorted.map(({ key, weight }, index) => {
        const amountMinor = index === sorted.length - 1 ? totalMinor - allocated : safeNumber((BigInt(totalMinor) * BigInt(weight)) / totalWeight);
        allocated += amountMinor;
        return Object.freeze({ key, amountMinor });
      })
    );
  }

  assertWithdrawal(settlementMinor: number, withdrawnMinor: number, requestMinor: number): void {
    if (![settlementMinor, withdrawnMinor, requestMinor].every(Number.isSafeInteger) || settlementMinor <= 0 || withdrawnMinor < 0 || requestMinor <= 0 || withdrawnMinor + requestMinor > settlementMinor) {
      throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
    }
  }
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
  return Number(value);
}
