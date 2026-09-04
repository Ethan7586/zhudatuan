import type { CatalogFilter } from '../model/CatalogFilter';
import type { CatalogPage } from '../model/CatalogPage';

export interface CatalogPort {
  read(filter: CatalogFilter, signal?: AbortSignal): Promise<CatalogPage>;
}
