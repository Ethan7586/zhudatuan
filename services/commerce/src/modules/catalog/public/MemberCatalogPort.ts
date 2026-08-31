import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface MemberCatalogPort {
  published(database: OperationDatabase, listing: string, mall: string): Promise<boolean>;
}

export const MEMBER_CATALOG_PORT = publicPort<MemberCatalogPort>('catalog', 'member');

export class PgMemberCatalogPort implements MemberCatalogPort {
  async published(database: OperationDatabase, listing: string, mall: string): Promise<boolean> {
    const result = await database.query<{ published: boolean }>(
      `select exists(select 1 from catalog.listing listing
      join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=$2 and binding.status='active'
      join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
      join catalog.product product on product.id=sku.product_id and product.status='active'
      where listing.id=$1 and listing.status='published'
      and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
      and (listing.expires_at is null or listing.expires_at>clock_timestamp())) published`,
      [listing, mall]
    );
    return result.rows[0]?.published === true;
  }
}
