import type { CatalogItem } from './CatalogItem';

export interface CatalogPage {
  readonly items: readonly CatalogItem[];
  readonly nextCursor: string | null;
  readonly version: string;
  readonly asOf: string;
}
