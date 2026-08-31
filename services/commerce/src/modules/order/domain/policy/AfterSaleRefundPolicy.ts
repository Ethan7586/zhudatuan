import { DomainError } from '../../../../foundation/domain/DomainError';

export class AfterSaleRefundPolicy {
  prorate(payableMinor: number, purchasedQuantity: number, requestedQuantity: number): number {
    if (![payableMinor, purchasedQuantity, requestedQuantity].every(Number.isSafeInteger)) throw new DomainError('VALIDATION_FAILED');
    if (payableMinor < 0 || purchasedQuantity <= 0 || requestedQuantity <= 0 || requestedQuantity > purchasedQuantity) {
      throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
    }
    return Math.floor((payableMinor * requestedQuantity) / purchasedQuantity);
  }

  plan(amountMinor: number, evidence: unknown, prior: readonly unknown[] = []): readonly Readonly<{ kind: string; reference: string | null; amountMinor: number }>[] {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new DomainError('VALIDATION_FAILED');
    const source = object(evidence).tenders;
    const tenders = (Array.isArray(source) ? source : []).map((value) => {
      const item = object(value);
      if (typeof item.kind !== 'string' || !Number.isSafeInteger(item.amountMinor) || Number(item.amountMinor) < 0) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
      return Object.freeze({ kind: item.kind, reference: typeof item.reference === 'string' ? item.reference : null, amountMinor: Number(item.amountMinor) });
    });
    const claimed = new Map<string, number>();
    for (const refund of prior)
      for (const value of Array.isArray(object(refund).tenders) ? (object(refund).tenders as unknown[]) : []) {
        const item = object(value);
        const key = `${String(item.kind)}:${typeof item.reference === 'string' ? item.reference : ''}`;
        claimed.set(key, (claimed.get(key) ?? 0) + (Number.isSafeInteger(item.amountMinor) ? Number(item.amountMinor) : 0));
      }
    let remaining = amountMinor;
    const plan: Array<Readonly<{ kind: string; reference: string | null; amountMinor: number }>> = [];
    for (const tender of [...tenders].reverse()) {
      const refundable = Math.max(0, tender.amountMinor - (claimed.get(`${tender.kind}:${tender.reference ?? ''}`) ?? 0));
      const amount = Math.min(refundable, remaining);
      if (amount > 0) plan.push(Object.freeze({ kind: tender.kind, reference: tender.reference, amountMinor: amount }));
      remaining -= amount;
    }
    if (remaining !== 0) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
    return Object.freeze(plan);
  }
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
