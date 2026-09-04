export type ProductFilter = Readonly<{
  readonly q: string;
  readonly category: string;
  readonly supplier: string;
  readonly mall: string;
  readonly status: string;
}>;

export const EMPTY_PRODUCT_FILTER: ProductFilter = Object.freeze({ q: '', category: '', supplier: '', mall: '', status: '' });
