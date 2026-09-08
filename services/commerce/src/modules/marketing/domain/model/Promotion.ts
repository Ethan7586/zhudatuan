import { DomainError } from '../../../../platform/error/DomainError';

export interface PromotionSnapshot {
  readonly priority: number;
  readonly fixedMinor: number;
  readonly basisPoints: number;
  readonly minimumSubtotal: number;
  readonly maximumMinor: number | null;
  readonly stackable: boolean;
  readonly exclusiveGroup: string;
}

export class PromotionRule {
  private constructor(private readonly value: PromotionSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(value: PromotionSnapshot): PromotionRule {
    return new PromotionRule(Object.freeze({ ...value }));
  }

  discount(subtotalMinor: number, availableMinor: number): number {
    minor(subtotalMinor, 'subtotal');
    minor(availableMinor, 'available');
    if (subtotalMinor < this.value.minimumSubtotal || availableMinor === 0) return 0;
    const proportional = Math.floor((subtotalMinor * this.value.basisPoints) / 10_000);
    return Math.min(subtotalMinor, availableMinor, this.value.maximumMinor ?? Number.MAX_SAFE_INTEGER, this.value.fixedMinor + proportional);
  }

  snapshot(): PromotionSnapshot {
    return this.value;
  }
}

function validate(value: PromotionSnapshot): void {
  minor(value.priority, 'priority', 1_000_000);
  minor(value.fixedMinor, 'fixedMinor');
  minor(value.basisPoints, 'basisPoints', 10_000);
  minor(value.minimumSubtotal, 'minimumSubtotal');
  if (value.maximumMinor !== null) minor(value.maximumMinor, 'maximumMinor');
  if (typeof value.stackable !== 'boolean') invalid('stackable');
  if (!/^[a-z][a-z0-9]{1,31}$/.test(value.exclusiveGroup)) invalid('exclusiveGroup');
  if (value.fixedMinor === 0 && value.basisPoints === 0) invalid('discount');
}

function minor(value: number, field: string, maximum = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) invalid(field);
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field: `promotion.${field}` });
}
