import type { CatalogItem } from './CatalogItem';

export interface CatalogPage {
  readonly items: readonly CatalogItem[];
  readonly categories: readonly Readonly<{ id: string; code: string; name: string; count: number }>[];
  readonly nextCursor: string | null;
  readonly version: string;
  readonly asOf: string;
}
