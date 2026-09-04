import { Money } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';

export type PricingRuleKind = 'markup' | 'discount' | 'tax' | 'freight';
export type PricingRuleState = 'draft' | 'published' | 'retired';

export interface PricingRuleSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly priority: number;
  readonly kind: PricingRuleKind;
  readonly condition: Readonly<Record<string, unknown>>;
  readonly effect: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly state: PricingRuleState;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly approvedBy: string | null;
}

export class PricingRule {
  private constructor(private readonly value: PricingRuleSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static draft(input: Omit<PricingRuleSnapshot, 'version' | 'state' | 'approvedBy'>): PricingRule {
    return new PricingRule(freeze({ ...input, effectiveAt: iso(input.effectiveAt), expiresAt: input.expiresAt === null ? null : iso(input.expiresAt), version: 1, state: 'draft', approvedBy: null }));
  }

  static restore(value: PricingRuleSnapshot): PricingRule {
    return new PricingRule(freeze(value));
  }

  publish(expectedVersion: number, approvedBy: string, at: Date): PricingRule {
    this.expect(expectedVersion);
    if (this.value.state !== 'draft' || !approvedBy || (this.value.expiresAt !== null && Date.parse(this.value.expiresAt) <= at.getTime())) {
      throw new DomainError('VALIDATION_FAILED', { field: 'rule', reason: 'RULE_NOT_PUBLISHABLE' });
    }
    return new PricingRule(freeze({ ...this.value, state: 'published', approvedBy, version: this.value.version + 1 }));
  }

  applies(sku: string, amount: Money, at: Date): boolean {
    if (this.value.state !== 'published' || at.getTime() < Date.parse(this.value.effectiveAt)) return false;
    if (this.value.expiresAt !== null && at.getTime() >= Date.parse(this.value.expiresAt)) return false;
    const skus = strings(this.value.condition.skuIds);
    if (skus.length > 0 && !skus.includes(sku)) return false;
    const minimum = integer(this.value.condition.minimumMinor, 0);
    const maximum = nullableInteger(this.value.condition.maximumMinor);
    return amount.minor >= minimum && (maximum === null || amount.minor <= maximum);
  }

  adjustment(base: Money): Money {
    const fixed = integer(this.value.effect.fixedMinor ?? this.value.effect.amountMinor, 0);
    const basisPoints = integer(this.value.effect.basisPoints, 0);
    const magnitude = Money.of(fixed, base.currency.code).add(base.multiplyRatio(basisPoints, 10_000));
    return this.value.kind === 'discount' ? Money.of(-magnitude.minor, base.currency.code) : magnitude;
  }

  stackable(): boolean {
    return this.value.effect.stackable === true;
  }

  group(): string {
    return typeof this.value.effect.exclusiveGroup === 'string' && this.value.effect.exclusiveGroup.length > 0 ? this.value.effect.exclusiveGroup : this.value.kind;
  }

  snapshot(): PricingRuleSnapshot {
    return this.value;
  }

  private expect(expectedVersion: number): void {
    if (expectedVersion !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: PricingRuleSnapshot): void {
  if (!/^rule:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !value.scope) invalid('rule');
  if (!Number.isSafeInteger(value.priority) || value.priority < 0 || value.priority > 1_000_000) invalid('priority');
  if (!['markup', 'discount', 'tax', 'freight'].includes(value.kind)) invalid('kind');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
  if (!['draft', 'published', 'retired'].includes(value.state)) invalid('state');
  if (value.state === 'published' && !value.approvedBy) invalid('approvedBy');
  const effective = Date.parse(value.effectiveAt);
  const expires = value.expiresAt === null ? null : Date.parse(value.expiresAt);
  if (Number.isNaN(effective) || (expires !== null && (Number.isNaN(expires) || expires <= effective))) invalid('period');
  strictStrings(value.condition.skuIds, 'skuIds');
  const minimum = integer(value.condition.minimumMinor, 0);
  const maximum = nullableInteger(value.condition.maximumMinor);
  if (maximum !== null && maximum < minimum) invalid('condition');
  integer(value.effect.fixedMinor ?? value.effect.amountMinor, 0);
  if (integer(value.effect.basisPoints, 0) > 1_000_000) invalid('basisPoints');
  if (value.effect.exclusiveGroup !== undefined && (typeof value.effect.exclusiveGroup !== 'string' || value.effect.exclusiveGroup.length === 0)) invalid('exclusiveGroup');
  if (value.effect.stackable !== undefined && typeof value.effect.stackable !== 'boolean') invalid('stackable');
}

function freeze(value: PricingRuleSnapshot): PricingRuleSnapshot {
  return Object.freeze({ ...value, condition: Object.freeze({ ...value.condition }), effect: Object.freeze({ ...value.effect }) });
}
function iso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid('time');
  return date.toISOString();
}
function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function strictStrings(value: unknown, field: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0) || new Set(value).size !== value.length) invalid(field);
}
function integer(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > Number.MAX_SAFE_INTEGER) invalid('effect');
  return Number(value);
}
function nullableInteger(value: unknown): number | null {
  return value === undefined || value === null ? null : integer(value, 0);
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
