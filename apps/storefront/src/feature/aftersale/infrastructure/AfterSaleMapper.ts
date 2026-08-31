import type { OperationOutputFor } from '@shop/contract';
import type { AfterSale, AfterSalePage } from '../model/AfterSale';
import type { AfterSaleReturn } from '../model/Return';

export function mapAfterSalePage(value: OperationOutputFor<'order.aftersales.read'>): AfterSalePage {
  return Object.freeze({
    items: Object.freeze(
      value.items.map((item) => Object.freeze({ ...item, lines: Object.freeze(item.lines), attachments: Object.freeze(item.attachments), returns: returns(item.timeline), timeline: Object.freeze(item.timeline) }) as AfterSale)
    ),
    availableLines: Object.freeze(value.availableLines.map((line) => Object.freeze({ ...line }))),
    nextCursor: value.nextCursor ?? null,
  });
}

function returns(timeline: readonly Readonly<{ evidence: unknown }>[]): readonly AfterSaleReturn[] {
  const found = new Map<string, AfterSaleReturn>();
  for (const item of timeline) {
    if (!item.evidence || typeof item.evidence !== 'object' || Array.isArray(item.evidence)) continue;
    const values = (item.evidence as Record<string, unknown>).returns;
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const source = value as Record<string, unknown>;
      if (typeof source.id !== 'string' || !['authorized', 'intransit', 'received', 'accepted', 'rejected'].includes(String(source.state))) continue;
      found.set(
        source.id,
        Object.freeze({
          id: source.id,
          state: source.state as AfterSaleReturn['state'],
          provider: typeof source.provider === 'string' ? source.provider : null,
          providerReference: typeof source.providerReference === 'string' ? source.providerReference : null,
          instruction: source.instruction && typeof source.instruction === 'object' && !Array.isArray(source.instruction) ? Object.freeze(source.instruction as Record<string, unknown>) : Object.freeze({}),
          trackingNumber: typeof source.trackingNumber === 'string' ? source.trackingNumber : null,
        })
      );
    }
  }
  return Object.freeze([...found.values()]);
}
