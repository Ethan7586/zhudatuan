export type OrderColumnKey = 'member' | 'product' | 'payment' | 'fulfillment' | 'aftersale';

export const ORDER_COLUMNS: readonly OrderColumnKey[] = Object.freeze(['member', 'product', 'payment', 'fulfillment', 'aftersale']);
