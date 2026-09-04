import { stringListPreference } from '../../../shared/preference/Preference';

export type OrderColumnKey = 'member' | 'product' | 'payment' | 'fulfillment' | 'aftersale';

export const ORDER_COLUMNS: readonly OrderColumnKey[] = Object.freeze(['member', 'product', 'payment', 'fulfillment', 'aftersale']);
export const ORDER_COLUMN_PREFERENCE = stringListPreference(ORDER_COLUMNS, ORDER_COLUMNS);
