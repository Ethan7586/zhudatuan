import { DomainError } from '../../../../foundation/domain/DomainError';

export class SettlementPolicy {
  assertDecision(requester: string | null, approver: string, amountMinor: number): void {
    if (!requester || requester === approver) throw new DomainError('FINANCE_SETTLEMENT_SEPARATION_REQUIRED');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
  }

  split(grossMinor: number, rule: unknown): Readonly<{ grossMinor: number; feeMinor: number; netMinor: number;
    invoiceBasis: 'gross' | 'net'; basisPoints: number }> {
    if (!Number.isSafeInteger(grossMinor) || grossMinor <= 0) throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
    const value = rule !== null && typeof rule === 'object' && !Array.isArray(rule) ? rule as Readonly<Record<string, unknown>> : {};
    const points = value.basisPoints === undefined ? 0 : value.basisPoints;
    const invoiceBasis = value.invoiceBasis === undefined ? 'gross' : value.invoiceBasis;
    if (!Number.isSafeInteger(points) || (points as number) < 0 || (points as number) > 5_000) {
      throw new DomainError('FINANCE_SETTLEMENT_FEE_INVALID');
    }
    if (invoiceBasis !== 'gross' && invoiceBasis !== 'net') throw new DomainError('FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID');
    const feeMinor = Math.floor(grossMinor * (points as number) / 10_000);
    const netMinor = grossMinor-feeMinor;
    if (!Number.isSafeInteger(feeMinor) || netMinor <= 0) throw new DomainError('FINANCE_SETTLEMENT_NET_INVALID');
    return Object.freeze({ grossMinor, feeMinor, netMinor, invoiceBasis, basisPoints: points as number });
  }
}
