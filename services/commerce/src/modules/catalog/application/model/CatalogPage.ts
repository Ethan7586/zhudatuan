export interface CatalogPage {
  readonly sort: string | null;
  readonly id: string | null;
  readonly fetch: number;
}

export interface CatalogRows {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly count: number;
}
