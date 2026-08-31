import type { CatalogFilter } from '../model/CatalogFilter';
import type { CatalogPage } from '../model/CatalogPage';
import { CatalogGateway } from '../infrastructure/CatalogGateway';
import { mapCatalog } from '../infrastructure/CatalogMapper';

export class ReadCatalog {
  async execute(filter: CatalogFilter = {}, signal?: AbortSignal): Promise<CatalogPage> {
    return mapCatalog(await CatalogGateway.read(filter, signal));
  }
}
