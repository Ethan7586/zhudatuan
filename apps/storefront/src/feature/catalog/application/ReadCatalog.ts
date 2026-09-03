import type { CatalogFilter } from '../model/CatalogFilter';
import type { CatalogPage } from '../model/CatalogPage';
import { CatalogGateway } from '../infrastructure/CatalogGateway';
import { mapCatalog } from '../infrastructure/CatalogMapper';

export class ReadCatalog {
  constructor(private readonly gateway: Pick<CatalogGateway, 'read'>) {}
  async execute(filter: CatalogFilter = {}, signal?: AbortSignal): Promise<CatalogPage> {
    return mapCatalog(await this.gateway.read(filter, signal));
  }
}
