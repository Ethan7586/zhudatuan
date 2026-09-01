import { createHash } from 'node:crypto';

export const INTERNAL_MALL_DATABASE = 'zhudatuan_internal_hongtai_20260817_20260831';
export const INTERNAL_MALL_DATASET = 'internal_hongtai_20260817_20260831_v1';
export const INTERNAL_MALL_SOURCE = 'synthetic_hongtai_reference';
export const INTERNAL_MALL_ENVIRONMENT = 'internal_test';
export const INTERNAL_MALL_REMARK = '宏泰半月内测数据';
export const INTERNAL_MALL_PREFIX = 'itht:';
export const INTERNAL_MALL_TIMEZONE = 'Asia/Shanghai';
export const INTERNAL_MALL_START_DATE = '2026-08-17';
export const DEFAULT_ORDERS_TARGET = 700;
export const DEFAULT_DAYS = 15;
export const DEFAULT_SEED = 20_260_817;

export const BASE_DAILY_ORDERS = Object.freeze([32, 36, 40, 43, 45, 60, 58, 38, 42, 46, 48, 52, 56, 54, 50]);

const STATUS_WEIGHTS = Object.freeze([
  ['completed_physical', 440],
  ['redeemed', 100],
  ['shipped', 50],
  ['paid_pending', 30],
  ['cancelled', 30],
  ['full_refund', 25],
  ['partial_refund', 25],
] as const);

const PAYMENT_WEIGHTS = Object.freeze([
  ['internal_only', 400],
  ['internal_cash', 150],
  ['mock_cash', 80],
  ['store_coupon', 40],
] as const);

export type OrderStatusBucket = typeof STATUS_WEIGHTS[number][0];
export type PaymentBucket = typeof PAYMENT_WEIGHTS[number][0];
export type ProductKind = 'physical' | 'voucher' | 'service';
export type ListingState = 'published' | 'draft' | 'unpublished';

export interface DatasetOptions {
  readonly database: string;
  readonly days: number;
  readonly host: string;
  readonly ordersTarget: number;
  readonly port: number;
  readonly seed: number;
}

export interface MemberFixture {
  readonly group: number;
  readonly id: string;
  readonly index: number;
  readonly membershipId: string;
  readonly membershipStatus: 'active' | 'suspended' | 'invited';
  readonly name: string;
  readonly principalId: string;
  readonly principalStatus: 'active' | 'disabled' | 'pending';
  readonly profileStatus: 'active' | 'disabled' | 'pending';
}

export interface ProductFixture {
  readonly categoryId: string;
  readonly id: string;
  readonly index: number;
  readonly kind: ProductKind;
  readonly name: string;
  readonly supplierId: string;
}

export interface SkuFixture {
  readonly code: string;
  readonly id: string;
  readonly initialStock: number;
  readonly isLowStock: boolean;
  readonly isSoldOut: boolean;
  readonly priceMinor: number;
  readonly product: ProductFixture;
  readonly purchaseMinor: number;
  readonly safety: number;
  readonly settlementMinor: number;
  readonly variant: number;
}

export interface ListingFixture {
  readonly id: string;
  readonly product: ProductFixture;
  readonly sku: SkuFixture;
  readonly state: ListingState;
}

export interface OrderLineFixture {
  readonly discountMinor: number;
  readonly id: string;
  readonly listing: ListingFixture;
  readonly payableMinor: number;
  readonly quantity: number;
  readonly totalMinor: number;
  readonly unitMinor: number;
}

export interface OrderTimes {
  readonly acceptedAt: string | null;
  readonly aftersaleAt: string | null;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly redeemedAt: string | null;
  readonly refundedAt: string | null;
  readonly shippedAt: string | null;
}

export interface OrderFixture {
  readonly couponIndex: number | null;
  readonly dayIndex: number;
  readonly discountMinor: number;
  readonly fulfillmentKind: 'shipment' | 'digital' | 'service' | 'pickup';
  readonly id: string;
  readonly index: number;
  readonly lines: readonly OrderLineFixture[];
  readonly lineSubtotalMinor: number;
  readonly member: MemberFixture;
  readonly number: string;
  readonly paymentBucket: PaymentBucket | null;
  readonly refundMinor: number;
  readonly serviceFeeMinor: number;
  readonly serviceFeeType: 'percentage_5' | 'owned' | 'fixed' | 'zero';
  readonly shippingMinor: number;
  readonly status: OrderStatusBucket;
  readonly storeId: string | null;
  readonly times: OrderTimes;
  readonly totalMinor: number;
  readonly voucherIndex: number | null;
}

export interface InternalMallPlan {
  readonly dailyCounts: readonly number[];
  readonly listings: readonly ListingFixture[];
  readonly members: readonly MemberFixture[];
  readonly orders: readonly OrderFixture[];
  readonly products: readonly ProductFixture[];
  readonly skus: readonly SkuFixture[];
}

export class DeterministicRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  integer(minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) throw new Error('INTERNAL_RANDOM_RANGE_INVALID');
    return minimum + Math.floor(this.next() * (maximum - minimum + 1));
  }

  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const selected = this.integer(0, index);
      [result[index], result[selected]] = [result[selected]!, result[index]!];
    }
    return result;
  }

  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((sum, value) => sum + value, 0);
    let selected = this.next() * total;
    for (let index = 0; index < weights.length; index += 1) {
      selected -= weights[index]!;
      if (selected < 0) return index;
    }
    return weights.length - 1;
  }
}

export function stableHash(...parts: readonly (number | string)[]): string {
  return createHash('sha256').update([INTERNAL_MALL_DATASET, ...parts].join('|')).digest('hex');
}

export function stableId(kind: string, ...parts: readonly (number | string)[]): string {
  return `${INTERNAL_MALL_PREFIX}${kind}:${stableHash(kind, ...parts).slice(0, 24)}`;
}

export function allocateLargestRemainder(total: number, weights: readonly number[], requireEach = false): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || weights.length === 0 || weights.some((weight) => weight < 0)) throw new Error('INTERNAL_ALLOCATION_INVALID');
  if (requireEach && total < weights.length) throw new Error('INTERNAL_ALLOCATION_REQUIRES_ONE_PER_BUCKET');
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  if (weightTotal <= 0) throw new Error('INTERNAL_ALLOCATION_WEIGHT_INVALID');
  const raw = weights.map((weight) => total * weight / weightTotal);
  const result = raw.map((value) => Math.floor(value));
  let remaining = total - result.reduce((sum, value) => sum + value, 0);
  const priority = raw.map((value, index) => ({ fraction: value - Math.floor(value), index }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) {
    const target = priority[index]!.index;
    result[target] = result[target]! + 1;
  }
  if (requireEach) {
    for (let index = 0; index < result.length; index += 1) {
      if (result[index]! > 0) continue;
      const donor = result.map((value, donorIndex) => ({ donorIndex, value })).sort((left, right) => right.value - left.value || left.donorIndex - right.donorIndex)
        .find(({ value }) => value > 1);
      if (!donor) throw new Error('INTERNAL_ALLOCATION_DONOR_MISSING');
      result[donor.donorIndex] = result[donor.donorIndex]! - 1;
      result[index] = 1;
    }
  }
  return result;
}

export function buildInternalMallPlan(options: DatasetOptions): InternalMallPlan {
  const random = new DeterministicRandom(options.seed);
  const members = buildMembers();
  const { listings, products, skus } = buildCatalog();
  const dailyCounts = allocateLargestRemainder(options.ordersTarget, dailyWeights(options.days), true);
  const statuses = expandWeighted(options.ordersTarget, STATUS_WEIGHTS, random);
  const fullRefundPositions = statuses.flatMap((status, index) => status === 'full_refund' ? [index] : []);
  const virtualRefundPositions = new Set(random.shuffle(fullRefundPositions).slice(0, Math.round(fullRefundPositions.length * 10 / 25)));
  const cancelled = statuses.filter((status) => status === 'cancelled').length;
  const payments = expandWeighted(options.ordersTarget - cancelled, PAYMENT_WEIGHTS, random);
  const paidPositions = statuses.flatMap((status, index) => status === 'cancelled' ? [] : [index]);
  const couponTarget = Math.min(paidPositions.length, Math.round(options.ordersTarget * 220 / DEFAULT_ORDERS_TARGET));
  const couponPositions = new Map(random.shuffle(paidPositions).slice(0, couponTarget).map((position, index) => [position, index]));
  const voucherEligible = paidPositions.filter((position) => {
    const paidIndex = paidPositions.indexOf(position);
    return payments[paidIndex] !== 'mock_cash';
  });
  const refundVoucherCandidates = random.shuffle(voucherEligible.filter((position) => ['full_refund', 'partial_refund'].includes(statuses[position]!)));
  const ordinaryVoucherCandidates = random.shuffle(voucherEligible.filter((position) => !['full_refund', 'partial_refund'].includes(statuses[position]!)));
  const voucherCandidates = [...refundVoucherCandidates, ...ordinaryVoucherCandidates];
  const voucherTarget = Math.min(150, voucherCandidates.length);
  const voucherPositions = new Map(voucherCandidates.slice(0, voucherTarget).map((position, index) => [position, index]));
  const timestamps = buildTimestamps(dailyCounts, random);
  const physical = listings.filter((listing) => listing.state === 'published' && listing.product.kind === 'physical' && !listing.sku.isLowStock && !listing.sku.isSoldOut);
  const voucher = listings.filter((listing) => listing.state === 'published' && listing.product.kind === 'voucher');
  const service = listings.filter((listing) => listing.state === 'published' && listing.product.kind === 'service');
  let paymentIndex = 0;
  const dayByOrder = dailyCounts.flatMap((count, dayIndex) => Array.from({ length: count }, () => dayIndex));
  const orders = statuses.map((status, index): OrderFixture => {
    const paymentBucket = status === 'cancelled' ? null : payments[paymentIndex++]!;
    const virtualRefund = virtualRefundPositions.has(index);
    const redeemed = status === 'redeemed' || virtualRefund;
    const source = redeemed ? (index % 2 === 0 ? voucher : service) : physical;
    const lineCount = orderLineCount(random);
    const selected = random.shuffle(source).slice(0, Math.min(lineCount, source.length));
    const rawLines = selected.map((listing, lineIndex) => {
      const quantity = lineIndex === 0 && index % 17 === 0 ? 3 : index % 11 === 0 ? 2 : 1;
      return { listing, quantity, totalMinor: listing.sku.priceMinor * quantity };
    });
    const lineSubtotalMinor = rawLines.reduce((sum, line) => sum + line.totalMinor, 0);
    const couponIndex = couponPositions.get(index) ?? null;
    const discountMinor = couponIndex === null ? 0 : Math.min(300 + index % 7 * 100, Math.max(100, Math.floor(lineSubtotalMinor * 0.15)));
    let discountRemaining = discountMinor;
    const lines = rawLines.map((line, lineIndex): OrderLineFixture => {
      const applied = Math.min(discountRemaining, line.totalMinor);
      discountRemaining -= applied;
      return {
        discountMinor: applied,
        id: stableId('line', index + 1, lineIndex + 1),
        listing: line.listing,
        payableMinor: line.totalMinor - applied,
        quantity: line.quantity,
        totalMinor: line.totalMinor,
        unitMinor: line.listing.sku.priceMinor,
      };
    });
    const serviceFeeType = serviceFeeTypeFor(index);
    const serviceFeeMinor = serviceFeeType === 'percentage_5' ? roundBasisPoints(lineSubtotalMinor, 500) : serviceFeeType === 'fixed' ? 300 : 0;
    const shippingMinor = redeemed ? 0 : index % 4 === 0 ? 0 : index % 3 === 0 ? 800 : 500;
    const totalMinor = lineSubtotalMinor + shippingMinor + serviceFeeMinor - discountMinor;
    const createdAt = timestamps[index]!;
    const times = stateTimes(createdAt, status, redeemed);
    const partialRefund = Math.min(Math.max(100, lines[0]!.payableMinor), Math.max(100, totalMinor - 1));
    return {
      couponIndex,
      dayIndex: dayByOrder[index]!,
      discountMinor,
      fulfillmentKind: redeemed ? (index % 2 === 0 ? 'digital' : index % 3 === 0 ? 'pickup' : 'service') : 'shipment',
      id: stableId('order', index + 1),
      index: index + 1,
      lines,
      lineSubtotalMinor,
      member: members[index % 180]!,
      number: `ITHT-${dateCompact(createdAt)}-${String(index + 1).padStart(5, '0')}`,
      paymentBucket,
      refundMinor: status === 'full_refund' ? totalMinor : status === 'partial_refund' ? partialRefund : 0,
      serviceFeeMinor,
      serviceFeeType,
      shippingMinor,
      status,
      storeId: redeemed && index % 2 === 1 ? `itht:store:${String(index % 6 + 1).padStart(2, '0')}` : null,
      times,
      totalMinor,
      voucherIndex: voucherPositions.get(index) ?? null,
    };
  });
  return Object.freeze({ dailyCounts, listings, members, orders, products, skus });
}

export function metadata(extra: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return Object.freeze({
    dataset_id: INTERNAL_MALL_DATASET,
    environment: INTERNAL_MALL_ENVIRONMENT,
    remark: INTERNAL_MALL_REMARK,
    source: INTERNAL_MALL_SOURCE,
    ...extra,
  });
}

function buildMembers(): MemberFixture[] {
  return Array.from({ length: 240 }, (_, zeroBased) => {
    const index = zeroBased + 1;
    const normal = index <= 210;
    const disabled = index > 210 && index <= 220;
    const pending = index > 220 && index <= 230;
    return Object.freeze({
      group: zeroBased % 8 + 1,
      id: `itht:member:${String(index).padStart(3, '0')}`,
      index,
      membershipId: `itht:membership:${String(index).padStart(3, '0')}`,
      membershipStatus: normal ? 'active' : disabled ? 'suspended' : 'invited',
      name: `内测会员${String(index).padStart(3, '0')}`,
      principalId: `itht:principal:${String(index).padStart(3, '0')}`,
      principalStatus: normal ? 'active' : disabled ? 'disabled' : pending ? 'pending' : 'active',
      profileStatus: normal ? 'active' : disabled ? 'disabled' : 'pending',
    });
  });
}

function buildCatalog(): Readonly<{ listings: ListingFixture[]; products: ProductFixture[]; skus: SkuFixture[] }> {
  const categoryIds = Array.from({ length: 12 }, (_, index) => `itht:category:${String(index + 1).padStart(2, '0')}`);
  const products = Array.from({ length: 120 }, (_, zeroBased): ProductFixture => {
    const index = zeroBased + 1;
    const kind: ProductKind = index <= 75 ? 'physical' : index <= 100 ? 'voucher' : 'service';
    const supplier = kind === 'physical' ? zeroBased % 5 + 1 : kind === 'voucher' ? 6 : zeroBased % 2 + 7;
    const label = kind === 'physical' ? '实物商品' : kind === 'voucher' ? '虚拟权益' : '门店服务';
    return Object.freeze({
      categoryId: categoryIds[zeroBased % categoryIds.length]!,
      id: `itht:product:${String(index).padStart(3, '0')}`,
      index,
      kind,
      name: `[内测] ${label}${String(index).padStart(3, '0')}`,
      supplierId: `itht:supplier:${String(supplier).padStart(2, '0')}`,
    });
  });
  const skus: SkuFixture[] = [];
  for (const product of products) {
    const variants = product.index <= 60 ? 2 : 1;
    for (let variant = 1; variant <= variants; variant += 1) {
      const ordinal = skus.length + 1;
      const listedVariant = variant === 1;
      const soldOut = listedVariant && product.kind === 'physical' && product.index >= 43 && product.index <= 50;
      const lowStock = listedVariant && product.kind === 'physical' && product.index >= 51 && product.index <= 65;
      const priceMinor = 2_590 + (ordinal * 1_373 % 36_000);
      const safety = product.kind === 'physical' ? 2 : 0;
      skus.push(Object.freeze({
        code: `ITHT-SKU-${String(ordinal).padStart(4, '0')}`,
        id: `itht:sku:${String(ordinal).padStart(4, '0')}`,
        initialStock: soldOut ? 0 : lowStock ? safety + 2 : product.kind === 'physical' ? 5_000 : 100_000,
        isLowStock: lowStock,
        isSoldOut: soldOut,
        priceMinor,
        product,
        purchaseMinor: Math.floor(priceMinor * 0.62),
        safety,
        settlementMinor: Math.floor(priceMinor * 0.82),
        variant,
      }));
    }
  }
  const listings = products.map((product): ListingFixture => {
    const sku = skus.find((candidate) => candidate.product.id === product.id && candidate.variant === 1)!;
    const state = listingState(product);
    return Object.freeze({ id: `itht:listing:${String(product.index).padStart(3, '0')}`, product, sku, state });
  });
  return Object.freeze({ listings, products, skus });
}

function listingState(product: ProductFixture): ListingState {
  if (product.kind === 'physical') return product.index <= 65 ? 'published' : product.index <= 70 ? 'draft' : 'unpublished';
  if (product.kind === 'voucher') return product.index <= 95 ? 'published' : product.index <= 98 ? 'draft' : 'unpublished';
  return product.index <= 115 ? 'published' : product.index <= 117 ? 'draft' : 'unpublished';
}

function dailyWeights(days: number): number[] {
  if (days === DEFAULT_DAYS) return [...BASE_DAILY_ORDERS];
  return Array.from({ length: days }, (_, index) => {
    const source = BASE_DAILY_ORDERS[Math.min(BASE_DAILY_ORDERS.length - 1, Math.floor(index * BASE_DAILY_ORDERS.length / days))]!;
    const day = new Date(`${INTERNAL_MALL_START_DATE}T00:00:00+08:00`);
    day.setUTCDate(day.getUTCDate() + index);
    const localWeekday = (day.getUTCDay() + 1) % 7;
    return source * (localWeekday === 0 || localWeekday === 6 ? 1.25 : 1);
  });
}

function expandWeighted<T extends string>(total: number, weights: readonly (readonly [T, number])[], random: DeterministicRandom): T[] {
  const counts = allocateLargestRemainder(total, weights.map(([, weight]) => weight));
  return random.shuffle(counts.flatMap((count, index) => Array.from({ length: count }, () => weights[index]![0])));
}

function buildTimestamps(dailyCounts: readonly number[], random: DeterministicRandom): string[] {
  const buckets = Object.freeze([
    [9 * 60, 11 * 60 + 30, 20],
    [11 * 60 + 30, 14 * 60, 30],
    [14 * 60, 18 * 60, 25],
    [18 * 60, 22 * 60, 25],
  ] as const);
  return dailyCounts.flatMap((count, dayIndex) => {
    const values = Array.from({ length: count }, (_, withinDay) => {
      const bucket = buckets[random.weightedIndex(buckets.map(([, , weight]) => weight))]!;
      const minute = random.integer(bucket[0], bucket[1] - 1);
      const second = (withinDay * 37 + random.integer(0, 59)) % 60;
      return timestamp(dayIndex, minute, second);
    });
    return random.shuffle(values);
  });
}

function timestamp(dayIndex: number, localMinute: number, second: number): string {
  const value = new Date(`${INTERNAL_MALL_START_DATE}T00:00:00+08:00`);
  value.setUTCDate(value.getUTCDate() + dayIndex);
  value.setUTCMinutes(value.getUTCMinutes() + localMinute);
  value.setUTCSeconds(second);
  return value.toISOString();
}

function plusMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

function stateTimes(createdAt: string, status: OrderStatusBucket, virtual: boolean): OrderTimes {
  if (status === 'cancelled') return Object.freeze({
    acceptedAt: null, aftersaleAt: null, cancelledAt: plusMinutes(createdAt, 12), completedAt: null, createdAt, paidAt: null,
    redeemedAt: null, refundedAt: null, shippedAt: null,
  });
  const paidAt = plusMinutes(createdAt, 5);
  const acceptedAt = plusMinutes(createdAt, 20);
  const shippedAt = virtual ? null : ['completed_physical', 'shipped', 'partial_refund'].includes(status) ? plusMinutes(createdAt, 180) : null;
  const redeemedAt = virtual ? plusMinutes(createdAt, 90) : null;
  const completedAt = ['completed_physical', 'redeemed', 'partial_refund'].includes(status) || (status === 'full_refund' && virtual)
    ? plusMinutes(createdAt, virtual ? 150 : 1_500) : null;
  const aftersaleAt = status === 'full_refund' || status === 'partial_refund'
    ? plusMinutes(completedAt ?? acceptedAt, 60) : null;
  const refundedAt = aftersaleAt === null ? null : plusMinutes(aftersaleAt, 45);
  return Object.freeze({ acceptedAt, aftersaleAt, cancelledAt: null, completedAt, createdAt, paidAt, redeemedAt, refundedAt, shippedAt });
}

function orderLineCount(random: DeterministicRandom): number {
  const value = random.weightedIndex([45, 38, 13, 3, 1]);
  return value + 1;
}

function serviceFeeTypeFor(index: number): OrderFixture['serviceFeeType'] {
  const value = index % 20;
  if (value < 13) return 'percentage_5';
  if (value < 17) return 'owned';
  if (value < 19) return 'fixed';
  return 'zero';
}

function roundBasisPoints(amountMinor: number, basisPoints: number): number {
  return Math.floor((amountMinor * basisPoints + 5_000) / 10_000);
}

function dateCompact(iso: string): string {
  const local = new Date(new Date(iso).getTime() + 8 * 60 * 60_000);
  return `${local.getUTCFullYear()}${String(local.getUTCMonth() + 1).padStart(2, '0')}${String(local.getUTCDate()).padStart(2, '0')}`;
}
