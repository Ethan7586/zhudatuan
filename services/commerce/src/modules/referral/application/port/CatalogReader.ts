export interface CatalogReader {
  product(scopeId: string, productId: string): Promise<Readonly<{ productId: string; active: boolean; version: number }> | null>;
}
