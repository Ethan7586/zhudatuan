import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CheckoutCatalogItem {
  readonly listing: string;
  readonly sku: string;
  readonly title: string;
  readonly listingVersion: number;
  readonly listingStatus: string;
  readonly product: string;
  readonly productType: string;
  readonly category: string;
  readonly productVersion: number;
  readonly skuVersion: number;
  readonly provider: string | null;
  readonly partner: string | null;
}

export interface CheckoutCatalogPort {
  items(database: OperationDatabase, scope: string, listings: readonly string[]): Promise<readonly CheckoutCatalogItem[]>;
}

export const CHECKOUT_CATALOG_PORT = publicPort<CheckoutCatalogPort>('catalog', 'checkout');

export class PgCheckoutCatalogPort implements CheckoutCatalogPort {
  async items(database: OperationDatabase, scope: string, listings: readonly string[]): Promise<readonly CheckoutCatalogItem[]> {
    if (listings.length === 0) return Object.freeze([]);
    const result = await database.query<{
      listing: string;
      sku: string;
      title: string;
      listingVersion: number;
      listingStatus: string;
      product: string;
      productType: string;
      category: string;
      productVersion: number;
      skuVersion: number;
      provider: string | null;
      partner: string | null;
    }>(
      `select listing.id listing,listing.sku_id sku,listing.title,
      listing.version::integer "listingVersion",listing.status "listingStatus",product.id product,
      product.product_type "productType",product.category_id category,product.version::integer "productVersion",
      sku.version::integer "skuVersion",source.provider,product.owner_partner_id partner
      from catalog.listing listing
      join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
      join catalog.product product on product.id=sku.product_id and product.status='active'
      left join lateral(select provider from catalog.sourcelisting source where source.sku_id=sku.id
        and source.scope_id=$1 and source.status='mapped' order by source.observed_at desc,source.id limit 1) source on true
      where listing.scope_id=$1 and listing.id=any($2::text[]) and listing.status='published'
      and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
      and (listing.expires_at is null or listing.expires_at>clock_timestamp()) order by listing.id`,
      [scope, listings]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
