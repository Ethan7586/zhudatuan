import type { Product } from '../types';
import { MOCK_PRODUCTS_A } from './products-a';
import { MOCK_PRODUCTS_B } from './products-b';
import { MOCK_PRODUCTS_C } from './products-c';
import { MOCK_PRODUCTS_D } from './products-d';

export * from './base';
export * from './orders';
export * from './accounts';

export const MOCK_PRODUCTS: Product[] = [...MOCK_PRODUCTS_A, ...MOCK_PRODUCTS_B, ...MOCK_PRODUCTS_C, ...MOCK_PRODUCTS_D];
