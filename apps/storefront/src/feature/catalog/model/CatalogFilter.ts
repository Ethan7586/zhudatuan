export interface CatalogFilter {
  readonly cursor?: string;
  readonly limit?: number;
  readonly productId?: string;
  readonly listingIds?: readonly string[];
  readonly categoryId?: string;
  readonly account?: 'welfare' | 'meal' | 'wechat' | 'cash';
  readonly exclusive?: boolean;
  readonly query?: string;
}
