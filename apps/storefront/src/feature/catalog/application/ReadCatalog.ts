import type { CatalogFilter } from '../model/CatalogFilter';
import type { CatalogPage } from '../model/CatalogPage';
import type { CatalogPort } from '../public/CatalogPort';

export class ReadCatalog {
  constructor(private readonly gateway: Pick<CatalogPort, 'read'>) {}
  async execute(filter: CatalogFilter = {}, signal?: AbortSignal): Promise<CatalogPage> {
    return this.gateway.read(filter, signal);
  }
}
