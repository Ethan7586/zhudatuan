export interface ProductFilter {
  readonly q: string;
  readonly category: string;
}

export const EMPTY_PRODUCT_FILTER: ProductFilter = Object.freeze({ q: '', category: '' });
