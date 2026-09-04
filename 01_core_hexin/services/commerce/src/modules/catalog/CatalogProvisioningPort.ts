import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface MallCatalogProvisioning {
  readonly mall: string;
  readonly pool: string;
  readonly name: string;
}

export class CatalogProvisioningPort {
  async createMallPool(database: OperationDatabase, input: MallCatalogProvisioning): Promise<void> {
    await database.query(`insert into catalog.pool(id,scope_id,kind,name,status,version)
      values($1,$2,'private',$3,'active',0)`, [input.pool, input.mall, `${input.name}默认商品池`]);
    await database.query(`insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
      values($1,$2,'selected','active',clock_timestamp(),clock_timestamp())`, [input.mall, input.pool]);
  }
}

export const catalogProvisioningPort = new CatalogProvisioningPort();
