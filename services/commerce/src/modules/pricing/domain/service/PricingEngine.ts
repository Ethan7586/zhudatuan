import { Money } from '@shop/kernel';
import type { Offer } from '../model/Offer';
import type { PricingRule } from '../model/PricingRule';
import { StackingPolicy } from '../policy/StackingPolicy';
import type { PriceComponent, PriceComponentKind } from '../value/PriceComponent';

export interface PricedOffer {
  readonly amount: Money;
  readonly compare: Money | null;
  readonly breakdown: readonly PriceComponent[];
  readonly rules: readonly Readonly<{ id: string; version: number }>[];
}

export class PricingEngine {
  constructor(private readonly stacking = new StackingPolicy()) {}

  price(offer: Offer, rules: readonly PricingRule[], at: Date): PricedOffer {
    const source = offer.effective(at);
    let current = source.amount;
    const breakdown: PriceComponent[] = [component('base', '基础价', source.amount.minor)];
    const applied = this.stacking.select(rules, source.sku, source.amount, at);
    for (const rule of applied) {
      let adjustment = rule.adjustment(current);
      if (adjustment.minor < 0 && -adjustment.minor > current.minor) adjustment = Money.of(-current.minor, current.currency.code);
      current = current.add(adjustment);
      breakdown.push(component(rule.snapshot().kind, label(rule.snapshot().kind), adjustment.minor));
    }
    const compare = source.compare === null || source.compare.minor < current.minor ? Money.of(current.minor, current.currency.code) : source.compare;
    return Object.freeze({ amount: current, compare, breakdown: Object.freeze(breakdown), rules: Object.freeze(applied.map((rule) => Object.freeze({ id: rule.snapshot().id, version: rule.snapshot().version }))) });
  }

  allocate(total: Money, lines: readonly Readonly<{ key: string; weight: Money }>[]): ReadonlyMap<string, Money> {
    if (total.minor < 0 || lines.length === 0 || lines.some(({ weight }) => !weight.currency.equals(total.currency) || weight.minor < 0)) throw new Error('PRICING_ALLOCATION_INVALID');
    const sum = lines.reduce((value, { weight }) => value.add(weight), Money.zero(total.currency.code));
    if (sum.minor === 0) throw new Error('PRICING_ALLOCATION_INVALID');
    const shares = lines.map(({ key, weight }) => {
      const numerator = BigInt(total.minor) * BigInt(weight.minor);
      return { key, amount: Number(numerator / BigInt(sum.minor)), remainder: numerator % BigInt(sum.minor) };
    });
    let remainder = total.minor - shares.reduce((value, item) => value + item.amount, 0);
    for (const item of [...shares].sort((left, right) => (left.remainder === right.remainder ? left.key.localeCompare(right.key) : left.remainder > right.remainder ? -1 : 1))) {
      if (remainder === 0) break;
      item.amount += 1;
      remainder -= 1;
    }
    if (remainder !== 0) throw new Error('PRICING_ALLOCATION_INVALID');
    return new Map(shares.map(({ key, amount }) => [key, Money.of(amount, total.currency.code)]));
  }
}

function component(kind: PriceComponentKind, labelValue: string, amountMinor: number): PriceComponent {
  return Object.freeze({ kind, label: labelValue, amountMinor });
}
function label(kind: PriceComponentKind): string {
  return { base: '基础价', markup: '加价', discount: '优惠', tax: '税费', freight: '运费' }[kind];
}
