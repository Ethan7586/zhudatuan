import type { JsonObject, JsonValue, RemoteOrderDraft } from '@shop/contract';
import { CAKEUNCLE_MEAL_BRANDS, type CakeuncleInvocation } from '@shop/vendorcakeuncle';
import type { MealBrand } from './BrandCatalog';

/** Internal only: not exported from the package until runtime idempotency and order re-query are implemented. */
export function buildMealOrderInvocation(draft: RemoteOrderDraft): CakeuncleInvocation {
  const payload = draft.payload;
  if (payload.schema !== 'cakeuncle.meal-order.v1') throw new Error('MEAL_ORDER_SCHEMA_INVALID');
  const brand = brandValue(payload.brand);
  const phone = text(payload.phone, 'MEAL_ORDER_PHONE_INVALID');
  const storeCode = text(payload.storeCode, 'MEAL_ORDER_STORE_INVALID');
  const goods = array(payload.goods, 'MEAL_ORDER_GOODS_INVALID').map((item) => object(item, 'MEAL_ORDER_GOOD_INVALID'));
  if (!goods.length) throw new Error('MEAL_ORDER_GOODS_INVALID');
  validateGoods(brand, goods);
  const model = payload.model;
  if (model !== undefined && typeof model !== 'string' && typeof model !== 'number') throw new Error('MEAL_ORDER_MODEL_INVALID');
  return Object.freeze({ operation: `meal.order.${brand}`, path: CAKEUNCLE_MEAL_BRANDS[brand].order,
    encoding: 'form', idempotent: false, body: Object.freeze({ phone, store_code: storeCode,
      ...(model === undefined ? {} : { model }), goods: JSON.stringify(goods) }) });
}

function validateGoods(brand: MealBrand, goods: readonly JsonObject[]): void {
  const contract = ({
    sbk: { required: ['num', 'product_id', 'amount', 'total_amount'], optional: ['sku_id', 'add_extra'] },
    kfc: { required: ['quantity', 'link_id', 'amount', 'total_amount'], optional: ['child_link_id', 'memo', 'condiment_items'] },
    mcd: { required: ['quantity', 'code', 'amount', 'total_amount'], optional: ['memo', 'combo_items'] },
    lk: { required: ['num', 'product_id', 'amount', 'total_amount'], optional: ['sku_code'] },
    cot: { required: ['num', 'item_no', 'amount', 'sku_no', 'total_amount'], optional: [] },
    pzh: { required: ['quantity', 'link_id', 'amount', 'total_amount'], optional: ['memo', 'meal_round_list'] },
    molly: { required: ['quantity', 'product_id', 'amount', 'sku_id', 'total_amount'], optional: ['memo', 'practice_list'] },
  } as const)[brand];
  const allowed = new Set<string>([...contract.required, ...contract.optional]);
  goods.forEach((item) => {
    contract.required.forEach((key) => {
      if (item[key] === undefined || item[key] === null || item[key] === '') throw new Error(`MEAL_ORDER_GOOD_FIELD_MISSING:${key}`);
    });
    if (Object.keys(item).some((key) => !allowed.has(key))) throw new Error('MEAL_ORDER_GOOD_FIELD_UNSUPPORTED');
  });
}

function brandValue(value: JsonValue | undefined): MealBrand {
  if (typeof value !== 'string' || !['sbk', 'kfc', 'mcd', 'lk', 'cot', 'pzh', 'molly'].includes(value)) {
    throw new Error('MEAL_ORDER_BRAND_INVALID');
  }
  return value as MealBrand;
}

function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function array(value: JsonValue | undefined, code: string): readonly JsonValue[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function object(value: JsonValue, code: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonObject;
}
