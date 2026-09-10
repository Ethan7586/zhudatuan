import { PgCatalogFacade } from './infrastructure/persistence/PgCatalogFacade';
import { ListingWithdrawal } from './infrastructure/persistence/ListingWithdrawal';
import { CatalogSourcePort } from './infrastructure/persistence/CatalogSourcePort';
import { PgCatalogSku } from './infrastructure/persistence/PgCatalogSku';

import { PgJobScheduler } from '../../platform/database/PgJobScheduler';
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { DATABASE_POOL } from '../../platform/database/Pool';
import { readDatabaseWorkload } from '../../platform/database/Workload';
import { CATALOG_INVENTORY_PORT } from '../inventory/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { CATALOG_PARTNER_PORT } from '../partner/public';
import { CATALOG_PRICE_COMMAND_PORT, CATALOG_PRICING_PORT } from '../pricing/public';
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { FacetsReadHandler } from './application/handler/FacetsReadHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { ListingsBatchHandler } from './application/handler/ListingsBatchHandler';
import { ListingsPublishHandler } from './application/handler/ListingsPublishHandler';
import { ListingsPriceSetHandler } from './application/handler/ListingsPriceSetHandler';
import { ListingsPoolSetHandler } from './application/handler/ListingsPoolSetHandler';
import { ListingsReadHandler } from './application/handler/ListingsReadHandler';
import { ListingsUnpublishHandler } from './application/handler/ListingsUnpublishHandler';
import { PoolsAllocateHandler } from './application/handler/PoolsAllocateHandler';
import { PoolsAttachHandler } from './application/handler/PoolsAttachHandler';
import { PoolsDetachHandler } from './application/handler/PoolsDetachHandler';
import { PoolsReadHandler } from './application/handler/PoolsReadHandler';
import { ProductDetailReadHandler } from './application/handler/ProductDetailReadHandler';
import { ProductsArchiveHandler } from './application/handler/ProductsArchiveHandler';
import { ProductsCreateHandler } from './application/handler/ProductsCreateHandler';
import { ProductsUpdateHandler } from './application/handler/ProductsUpdateHandler';
import { CatalogScopeReader } from './infrastructure/persistence/CatalogScopeReader';
import { PgListingRepository } from './infrastructure/persistence/PgListingRepository';
import { PgPoolRepository } from './infrastructure/persistence/PgPoolRepository';
import { PgProductRepository } from './infrastructure/persistence/PgProductRepository';
import { Manifest } from './Manifest';
import { CART_CATALOG_PORT } from './public/CartCatalogPort';
import { CATALOG_READ_PORT } from './public/CatalogReadPort';
import { CATALOG_DIMENSION_PORT } from './public/CatalogDimensionPort';
import { CHECKOUT_CATALOG_PORT } from './public/CheckoutCatalogPort';
import { EXPERIENCE_CATALOG_PORT } from './public/ExperienceCatalogPort';
import { MEMBER_CATALOG_PORT } from './public/MemberCatalogPort';
import { REFERRAL_CATALOG_PORT } from './public/ReferralCatalogPort';
import { INVENTORY_CATALOG_PORT, PROVIDER_CATALOG_PORT, RISK_CATALOG_PORT } from './public';
import { createJobs, createProviderJobs } from './interface/job/JobFactory';
import { CATALOG_QUALIFICATION_PORT } from '../qualification/public';
import { ListingPublication } from './application/service/ListingPublication';
import { IMPORT_OBJECT_PORT, RUNTIME_IMPORT_PORT } from '../runtime/public';
import { ASSET_PORT } from '../runtime/public';
import { MediauploadsCreateHandler } from './application/handler/MediauploadsCreateHandler';
import { ProductMedia } from './application/service/ProductMedia';
import { CategoriesReadHandler } from './application/handler/CategoriesReadHandler';
import { CategoriesCreateHandler } from './application/handler/CategoriesCreateHandler';
import { PgCategoryRepository } from './infrastructure/persistence/PgCategoryRepository';
import { StorefrontCatalogMedia } from './application/service/StorefrontCatalogMedia';
import type { CatalogReadPort } from './public/CatalogReadPort';

export const CatalogModule = defineModule(Manifest, {
  jobs: createJobs,
  providerJobs: createProviderJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const scopes = new CatalogScopeReader(context.ports.get(ORGANIZATION_READ_PORT));
    const pools = new PgPoolRepository(transactions, scopes);
    const categories = new PgCategoryRepository(transactions);
    const products = new PgProductRepository(transactions, scopes, context.ports.get(CATALOG_PARTNER_PORT));
    const listings = new PgListingRepository(transactions, scopes);
    const partners = context.ports.get(CATALOG_PARTNER_PORT);
    const imports = context.ports.get(RUNTIME_IMPORT_PORT);
    const objects = context.service(OBJECT_STORE);
    const assets = context.ports.get(ASSET_PORT);
    const media = new ProductMedia(assets);
    const publication = new ListingPublication(listings, context.ports.get(CATALOG_QUALIFICATION_PORT), context.ports.get(CATALOG_PRICING_PORT), context.ports.get(CATALOG_INVENTORY_PORT));
    return [
      new CategoriesReadHandler(categories),
      new CategoriesCreateHandler(categories),
      new PoolsReadHandler(pools),
      new PoolsAttachHandler(pools),
      new PoolsDetachHandler(pools),
      new PoolsAllocateHandler(pools),
      new ProductDetailReadHandler(products, context.ports.get(CATALOG_INVENTORY_PORT), context.ports.get(CATALOG_PRICING_PORT), context.ports.get(CATALOG_QUALIFICATION_PORT), context.ports.get(ORGANIZATION_READ_PORT), media),
      new MediauploadsCreateHandler(assets),
      new ProductsCreateHandler(products, media),
      new ProductsUpdateHandler(products, media),
      new ProductsArchiveHandler(products),
      new FacetsReadHandler(listings, partners),
      new ListingsReadHandler(listings, context.ports.get(CATALOG_INVENTORY_PORT), context.ports.get(CATALOG_PRICING_PORT), context.ports.get(CATALOG_QUALIFICATION_PORT), partners, media),
      new ListingsPublishHandler(publication),
      new ListingsPriceSetHandler(listings, context.ports.get(CATALOG_PRICE_COMMAND_PORT)),
      new ListingsPoolSetHandler(listings),
      new ListingsUnpublishHandler(publication),
      new ListingsBatchHandler(publication),
      new ImportsCreateHandler(imports, new PgJobScheduler(transactions), context.ports.get(IMPORT_OBJECT_PORT)),
      new ImportsReadHandler(imports, objects),
    ];
  },
  ports: (context) => {
    const facade = new PgCatalogFacade(context.service(DATABASE_POOL).workload(readDatabaseWorkload(context.workload)));
    const storefront = new StorefrontCatalogMedia(facade, new ProductMedia(context.ports.get(ASSET_PORT)));
    return [...catalogPorts(facade, storefront)];
  },
  jobPorts: (context) => {
    const facade = new PgCatalogFacade(context.service(DATABASE_POOL));
    return [
      { token: RISK_CATALOG_PORT, value: new ListingWithdrawal() },
      { token: INVENTORY_CATALOG_PORT, value: new PgCatalogSku() },
      { token: EXPERIENCE_CATALOG_PORT, value: facade },
      { token: CATALOG_DIMENSION_PORT, value: facade },
    ];
  },
  providerPorts: [{ token: PROVIDER_CATALOG_PORT, value: new CatalogSourcePort() }],
});
function catalogPorts(facade: PgCatalogFacade, storefront: CatalogReadPort) {
  return [
    { token: REFERRAL_CATALOG_PORT, value: facade },
    { token: CART_CATALOG_PORT, value: facade },
    { token: CHECKOUT_CATALOG_PORT, value: facade },
    { token: EXPERIENCE_CATALOG_PORT, value: facade },
    { token: CATALOG_READ_PORT, value: storefront },
    { token: CATALOG_DIMENSION_PORT, value: facade },
    { token: MEMBER_CATALOG_PORT, value: facade },
  ] as const;
}
