export type OrderSection = 'summary' | 'products' | 'payment' | 'fulfillment' | 'aftersale' | 'finance' | 'audit';

export class OrderVisibility {
  sections(scopeKind: string): ReadonlySet<OrderSection> {
    if (scopeKind === 'owner' || scopeKind === 'self') return frozen(['summary', 'products', 'payment', 'fulfillment', 'aftersale']);
    if (scopeKind === 'supplier' || scopeKind === 'store') return frozen(['summary', 'products', 'fulfillment', 'aftersale']);
    return frozen(['summary', 'products', 'payment', 'fulfillment', 'aftersale', 'finance', 'audit']);
  }
}

function frozen(values: readonly OrderSection[]): ReadonlySet<OrderSection> {
  return Object.freeze(new Set(values));
}
