import type { ProductColumnKey } from '../view/ProductTable';
import { stringListPreference } from '../../../shared/preference/Preference';

export const PRODUCT_COLUMNS: readonly ProductColumnKey[] = Object.freeze(['category', 'sku', 'malls', 'price', 'stock', 'status', 'updated']);
export const PRODUCT_COLUMN_PREFERENCE = stringListPreference(PRODUCT_COLUMNS, PRODUCT_COLUMNS);
