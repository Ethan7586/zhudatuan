import type { Product } from '../../../entity/product';
import type { Cart } from '../model/Cart';
import type { CartSnapshot } from '../model/CartSnapshot';

export function projectCart(value: CartSnapshot | undefined, products: readonly Product[]): Cart {
  const lines = (value?.items ?? []).map((line) => {
    const product = products.find((item) => item.listingId === line.listing && item.skuId === line.sku) ?? fallback(line);
    return Object.freeze({
      id: line.listing,
      listingId: line.listing,
      skuId: line.sku,
      lineVersion: Number(line.version),
      product,
      title: product.title || line.title,
      amountMinor: line.amountMinor,
      currency: line.currency,
      available: line.available,
      benefitApplicable: line.benefitApplicable,
      validity: line.validity,
      quantity: Number(line.quantity),
      selectedSpec: Object.freeze({}),
      selected: line.selected,
    });
  });
  return Object.freeze({ version: Number(value?.version ?? 0), lines: Object.freeze(lines) });
}

function fallback(line: CartSnapshot['items'][number]): Product {
  const amount = line.amountMinor ?? 0;
  return Object.freeze({
    listingId: line.listing,
    productId: line.listing,
    skuId: line.sku,
    title: line.title,
    subtitle: line.validity.message,
    images: Object.freeze([]),
    priceMarketMinor: amount,
    priceMallMinor: amount,
    priceWelfareMinor: amount,
    currency: line.currency ?? 'CNY',
    categoryId: '',
    categoryName: '',
    brand: '',
    tags: Object.freeze([]),
    supplierId: '',
    supplierName: '',
    itemType: 'unknown',
    allowedAccounts: Object.freeze(line.benefitApplicable ? ['welfare' as const] : []),
    stock: line.available ?? 0,
    salesCount: 0,
    rating: 0,
    reviewCount: 0,
    deliverySla: '',
    qualification: Object.freeze({ eligible: line.validity.state === 'valid', policyVersion: null }),
    saleability: Object.freeze({ state: line.validity.state === 'valid' ? ('saleable' as const) : ('blocked' as const), reasons: Object.freeze(line.validity.state === 'valid' ? [] : ['inventory_unavailable' as const]) }),
    version: String(line.version),
    updatedAt: '',
    skus: Object.freeze([{ id: line.sku, listingId: line.listing, productId: line.listing, priceMinor: amount, compareMinor: null, currency: line.currency ?? 'CNY', available: line.available ?? 0, state: line.validity.state === 'valid' ? ('available' as const) : ('unavailable' as const), priceVersion: 'live', inventoryVersion: 'live', qualification: Object.freeze({ eligible: line.validity.state === 'valid', policyVersion: null }), saleability: Object.freeze({ state: line.validity.state === 'valid' ? ('saleable' as const) : ('blocked' as const), reasons: Object.freeze(line.validity.state === 'valid' ? [] : ['inventory_unavailable' as const]) }), specifications: Object.freeze({}) }]),
  });
}
