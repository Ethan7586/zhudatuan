import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CatalogSku } from '../../application/port/CatalogSku';

export class PgCatalogSku implements CatalogSku {
  async find(database: OperationDatabase, scope: string, reference: string): Promise<string | null> {
    const selected = await database.query<{ id: string }>(
      `select sku.id from catalog.sku sku join catalog.product product on product.id=sku.product_id
      where (sku.id=$1 or sku.code=$1) and (product.owner_partner_id=$2 or exists(select 1 from catalog.sourcelisting source
        where source.sku_id=sku.id and source.scope_id=$2)) order by (sku.id=$1) desc limit 1`,
      [reference, scope]
    );
    return selected.rows[0]?.id ?? null;
  }
}
