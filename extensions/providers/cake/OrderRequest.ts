import type { JsonObject } from '@shop/contract';

export type CakeShipType = 'delivery' | 'same' | 'shop';

export interface CakeOrderRequestInput {
  readonly userId: string;
  readonly recipient: {
    readonly name: string;
    readonly phone: string;
  };
  readonly buyerPhone: string;
  readonly delivery: {
    readonly cityName: string;
    readonly area: string;
    readonly address: string;
    readonly areaCode: string;
  };
  readonly orders: readonly CakeOrderGroup[];
}

export interface CakeOrderGroup {
  readonly specIds: readonly string[];
  readonly clearingPricesMinor: readonly number[];
  readonly quantities: readonly number[];
  readonly tastes?: readonly string[];
  readonly shipType: CakeShipType;
  readonly shipDate?: string;
  readonly shipTimeText?: string;
  readonly buyerMessage?: string;
  readonly chargeIds?: readonly string[];
  readonly chargeQuantities?: readonly number[];
  readonly shopId?: string;
}

/** Builds the documented request body only. It is intentionally not connected to an order port. */
export function buildCakeOrderRequest(outOrderNo: string, input: CakeOrderRequestInput): JsonObject {
  const reference = text(outOrderNo, 'CAKE_ORDER_REFERENCE_INVALID', 128);
  if (input.orders.length === 0) throw new Error('CAKE_ORDER_GROUPS_EMPTY');
  return Object.freeze({
    out_order_no: reference,
    name: text(input.recipient.name, 'CAKE_ORDER_RECIPIENT_INVALID', 64),
    city_name: text(input.delivery.cityName, 'CAKE_ORDER_CITY_INVALID', 64),
    area: text(input.delivery.area, 'CAKE_ORDER_AREA_INVALID', 128),
    addr: text(input.delivery.address, 'CAKE_ORDER_ADDRESS_INVALID', 256),
    area_code: digits(input.delivery.areaCode, 'CAKE_ORDER_AREA_CODE_INVALID'),
    user_id: text(input.userId, 'CAKE_ORDER_USER_INVALID', 128),
    buyer_phone: phone(input.buyerPhone, 'CAKE_ORDER_BUYER_PHONE_INVALID'),
    phone: phone(input.recipient.phone, 'CAKE_ORDER_RECIPIENT_PHONE_INVALID'),
    orders: Object.freeze(input.orders.map(orderGroup)),
  });
}

function orderGroup(group: CakeOrderGroup): JsonObject {
  if (group.specIds.length === 0 || group.specIds.length !== group.clearingPricesMinor.length ||
    group.specIds.length !== group.quantities.length) throw new Error('CAKE_ORDER_GROUP_LENGTH_INVALID');
  const specIds = group.specIds.map((value) => digits(value, 'CAKE_ORDER_SPEC_ID_INVALID'));
  if (new Set(specIds).size !== specIds.length) throw new Error('CAKE_ORDER_SPEC_DUPLICATE');
  const prices = group.clearingPricesMinor.map((value) => money(value, 'CAKE_ORDER_CLEARING_PRICE_INVALID'));
  const quantities = group.quantities.map((value) => positive(value, 'CAKE_ORDER_QUANTITY_INVALID'));
  const hasSchedule = group.shipDate !== undefined || group.shipTimeText !== undefined;
  if (group.shipType === 'same' && hasSchedule) throw new Error('CAKE_ORDER_SAME_SCHEDULE_FORBIDDEN');
  if (group.shipType !== 'same' && (!group.shipDate || !group.shipTimeText)) throw new Error('CAKE_ORDER_SCHEDULE_REQUIRED');
  if (group.shipType === 'shop' && !group.shopId) throw new Error('CAKE_ORDER_SHOP_REQUIRED');
  if (group.shipType !== 'shop' && group.shopId !== undefined) throw new Error('CAKE_ORDER_SHOP_FORBIDDEN');
  if (group.tastes !== undefined && group.tastes.length !== specIds.length) throw new Error('CAKE_ORDER_TASTES_LENGTH_INVALID');
  const chargeIds = group.chargeIds;
  const chargeQuantities = group.chargeQuantities;
  if ((chargeIds === undefined) !== (chargeQuantities === undefined) ||
    (chargeIds !== undefined && chargeIds.length !== chargeQuantities!.length)) throw new Error('CAKE_ORDER_CHARGES_LENGTH_INVALID');
  if (chargeIds !== undefined && chargeIds.length === 0) throw new Error('CAKE_ORDER_CHARGES_EMPTY');
  return Object.freeze({
    spec_ids: specIds.join(','),
    clearing_prices: prices.join(','),
    quantitys: quantities.join(','),
    ...(group.tastes === undefined ? {} : { tastes: group.tastes.map((value) => text(value, 'CAKE_ORDER_TASTE_INVALID', 128)).join(',') }),
    ship_type: group.shipType,
    ...(group.shipType === 'same' ? {} : {
      ship_date: date(group.shipDate!),
      ship_time_text: text(group.shipTimeText!, 'CAKE_ORDER_SHIP_TIME_INVALID', 128),
    }),
    ...(group.buyerMessage === undefined ? {} : { buyer_msg: text(group.buyerMessage, 'CAKE_ORDER_BUYER_MESSAGE_INVALID', 500) }),
    ...(chargeIds === undefined ? {} : {
      charge_ids: chargeIds.map((value) => digits(value, 'CAKE_ORDER_CHARGE_ID_INVALID')).join(','),
      cquantitys: chargeQuantities!.map((value) => positive(value, 'CAKE_ORDER_CHARGE_QUANTITY_INVALID')).join(','),
    }),
    ...(group.shopId === undefined ? {} : { shop_id: digits(group.shopId, 'CAKE_ORDER_SHOP_INVALID') }),
  });
}

function text(value: string, code: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(code);
  return normalized;
}

function digits(value: string, code: string): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) throw new Error(code);
  return normalized;
}

function phone(value: string, code: string): string {
  const normalized = value.replace(/[\s-]/g, '');
  if (!/^1[3-9]\d{9}$/.test(normalized)) throw new Error(code);
  return normalized;
}

function positive(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
  return value;
}

function money(value: number, code: string): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

function date(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('CAKE_ORDER_SHIP_DATE_INVALID');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('CAKE_ORDER_SHIP_DATE_INVALID');
  return value;
}
