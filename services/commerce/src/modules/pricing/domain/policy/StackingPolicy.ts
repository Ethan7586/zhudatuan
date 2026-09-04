import type { Money } from '@shop/kernel';
import type { PricingRule } from '../model/PricingRule';

export class StackingPolicy {
  select(rules: readonly PricingRule[], sku: string, amount: Money, at: Date): readonly PricingRule[] {
    const selected: PricingRule[] = [];
    const exclusive = new Set<string>();
    for (const rule of [...rules].sort(compare)) {
      if (!rule.applies(sku, amount, at)) continue;
      const group = rule.group();
      if (!rule.stackable() && exclusive.has(group)) continue;
      selected.push(rule);
      if (!rule.stackable()) exclusive.add(group);
    }
    return Object.freeze(selected);
  }
}

function compare(left: PricingRule, right: PricingRule): number {
  const a = left.snapshot();
  const b = right.snapshot();
  return stage(a.kind) - stage(b.kind) || a.priority - b.priority || a.id.localeCompare(b.id);
}
function stage(kind: ReturnType<PricingRule['snapshot']>['kind']): number {
  return { markup: 1, discount: 2, tax: 3, freight: 4 }[kind];
}
