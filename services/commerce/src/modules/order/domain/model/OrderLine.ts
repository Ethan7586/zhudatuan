import { DomainError } from '../../../../foundation/domain/DomainError';

export interface OrderLineSnapshot {
  readonly id: string;
  readonly sku: string;
  readonly listing: string;
  readonly product: string;
  readonly productType: string;
  readonly category: string;
  readonly title: string;
  readonly quantity: number;
  readonly unitMinor: number;
  readonly totalMinor: number;
  readonly discountMinor: number;
  readonly payableMinor: number;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly versions: Readonly<{ listing: number; product: number; sku: number; price: string; stock: number }>;
}

export class OrderLine {
  private constructor(readonly value: OrderLineSnapshot) {}

  static freeze(value: OrderLineSnapshot): OrderLine {
    const integers = [value.quantity, value.unitMinor, value.totalMinor, value.discountMinor, value.payableMinor, value.versions.listing, value.versions.product, value.versions.sku, value.versions.stock];
    if (!value.id || !value.sku || !value.listing || !value.product || !value.title || !value.versions.price || integers.some((item) => !Number.isSafeInteger(item))) invalid();
    if (value.quantity <= 0 || value.unitMinor < 0 || value.totalMinor !== value.unitMinor * value.quantity || value.discountMinor < 0 || value.payableMinor !== value.totalMinor - value.discountMinor) invalid();
    return new OrderLine(Object.freeze({ ...value, versions: Object.freeze({ ...value.versions }) }));
  }
}

function invalid(): never {
  throw new DomainError('ORDER_SNAPSHOT_INVALID');
}
