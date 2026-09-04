export const CAKEUNCLE_PHYSICAL_ENDPOINTS = Object.freeze({
  categories: '/channelapi/product/get_cats_list',
  products: '/channelapi/product/get_products_list',
  deliveryRules: '/channelapi/order/get_distribution_rules',
  submitOrder: '/channelapi/order/submit_order',
  orderDetail: '/channelapi/order/order_detail',
  balance: '/channelapi/order/get_channel_order_money',
  payment: '/channelapi/order/payment_callback',
  cities: '/channelapi/product/get_citys_list',
  brands: '/channelapi/brand/get_brands_list',
  stores: '/channelapi/brand/get_shops_list',
} as const);

export const CAKEUNCLE_VOUCHER_ENDPOINTS = Object.freeze({
  products: '/couponrecharge/coupon_saas_api/get_product_lists',
} as const);

export const CAKEUNCLE_MEAL_BRANDS = Object.freeze({
  sbk: Object.freeze({ menu: '/h5/online/sbk_list_by_store', detail: '/h5/online/sbk_product_detail', order: '/h5/online/sbk_create_order' }),
  kfc: Object.freeze({ menu: '/h5/online/kfc_list_by_store', detail: '/h5/online/kfc_product_detail', order: '/h5/online/kfc_create_order' }),
  mcd: Object.freeze({ menu: '/h5/online/mcd_list_by_store', detail: '/h5/online/mcd_product_detail', order: '/h5/online/mcd_create_order' }),
  lk: Object.freeze({ menu: '/h5/online/lk_list_by_store', detail: '/h5/online/lk_product_detail', order: '/h5/online/lk_create_order' }),
  cot: Object.freeze({ menu: '/h5/online/cot_list_by_store', detail: '/h5/online/cot_product_detail', order: '/h5/online/cot_create_order' }),
  pzh: Object.freeze({ menu: '/h5/online/pzh_list_by_store', detail: null, order: '/h5/online/pzh_create_order' }),
  molly: Object.freeze({ menu: '/h5/online/molly_list_by_store', detail: '/h5/online/molly_product_detail', order: '/h5/online/molly_create_order' }),
} as const);

export type CakeuncleMealBrand = keyof typeof CAKEUNCLE_MEAL_BRANDS;

export const CAKEUNCLE_MEAL_COMMON_ENDPOINTS = Object.freeze({
  orderDetail: '/h5/online/order_detail',
  payment: '/h5/online/pay_result',
} as const);
