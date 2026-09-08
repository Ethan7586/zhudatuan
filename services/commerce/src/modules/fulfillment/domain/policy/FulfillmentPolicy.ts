export type FulfillmentRoute = 'physical' | 'digital' | 'voucher' | 'channel';
export type FulfillmentKind = 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';

export interface FulfillmentSourceLine {
  readonly line: string;
  readonly quantity: number;
  readonly payableMinor: number;
  readonly productType: string;
}
export interface FulfillmentSourcePlan {
  readonly suborder: string;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly lines: readonly FulfillmentSourceLine[];
}
export interface FulfillmentPlan {
  readonly key: string;
  readonly suborder: string;
  readonly route: FulfillmentRoute;
  readonly kind: FulfillmentKind;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly amountMinor: number;
  readonly lines: readonly Readonly<{ line: string; quantity: number }>[];
}

export class FulfillmentPolicy {
  split(sources: readonly FulfillmentSourcePlan[]): readonly Readonly<FulfillmentPlan>[] {
    const result: FulfillmentPlan[] = [];
    for (const source of sources) {
      if (!source.suborder || source.lines.length === 0) throw new Error('FULFILLMENT_PLAN_INVALID');
      const groups = new Map<string, { route: FulfillmentRoute; kind: FulfillmentKind; lines: FulfillmentSourceLine[] }>();
      for (const line of source.lines) {
        if (!line.line || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.payableMinor) || line.payableMinor < 0) throw new Error('FULFILLMENT_PLAN_INVALID');
        const route = this.route(line.productType, source.provider);
        const kind = this.kind(line.productType);
        const key = `${route}:${kind}`;
        const group = groups.get(key) ?? { route, kind, lines: [] };
        group.lines.push(line);
        groups.set(key, group);
      }
      for (const [key, group] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
        result.push(
          Object.freeze({
            key: `${source.suborder}:${key}`,
            suborder: source.suborder,
            route: group.route,
            kind: group.kind,
            provider: source.provider,
            partner: source.partner,
            amountMinor: group.lines.reduce((sum, line) => sum + line.payableMinor, 0),
            lines: Object.freeze(group.lines.map(({ line, quantity }) => Object.freeze({ line, quantity }))),
          })
        );
      }
    }
    if (new Set(result.map(({ key }) => key)).size !== result.length) throw new Error('FULFILLMENT_PLAN_DUPLICATE');
    return Object.freeze(result);
  }

  route(productType: string, provider: string | null): FulfillmentRoute {
    if (provider) return 'channel';
    const normalized = productType.trim().toLowerCase();
    if (['voucher', 'coupon', 'credential', 'card'].includes(normalized)) return 'voucher';
    if (['virtual', 'digital', 'recharge'].includes(normalized)) return 'digital';
    return 'physical';
  }

  kind(productType: string): FulfillmentKind {
    const normalized = productType.trim().toLowerCase();
    if (normalized === 'service') return 'service';
    if (['voucher', 'coupon', 'credential', 'card', 'virtual', 'digital', 'recharge'].includes(normalized)) return 'digital';
    return 'shipment';
  }
}
