import { PgReferralCatalogPort } from './infrastructure/persistence/PgReferralCatalogPort';
import { PgMemberCatalogPort } from './infrastructure/persistence/PgMemberCatalogPort';
import { PgExperienceCatalogPort } from './infrastructure/persistence/PgExperienceCatalogPort';
import { PgCheckoutCatalogPort } from './infrastructure/persistence/PgCheckoutCatalogPort';
import { PgCatalogReadPort } from './infrastructure/persistence/PgCatalogReadPort';
import { PgCartCatalogPort } from './infrastructure/persistence/PgCartCatalogPort';
import { CatalogRiskDecisionService } from './infrastructure/persistence/CatalogRiskDecisionService';
import { CatalogSourcePort } from './infrastructure/persistence/CatalogSourcePort';
import { PgCatalogSku } from './infrastructure/persistence/PgCatalogSku';

import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { OBJECT_STORE } from '../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
import { CATALOG_INVENTORY_PORT } from '../inventory/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { CATALOG_PARTNER_PORT } from '../partner/public';
import { CATALOG_PRICING_PORT } from '../pricing/public';
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { ListingsBatchHandler } from './application/handler/ListingsBatchHandler';
import { ListingsPublishHandler } from './application/handler/ListingsPublishHandler';
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
import { PgCatalogImportRepository } from './infrastructure/persistence/PgCatalogImportRepository';
import { PgListingRepository } from './infrastructure/persistence/PgListingRepository';
import { PgPoolRepository } from './infrastructure/persistence/PgPoolRepository';
import { PgProductRepository } from './infrastructure/persistence/PgProductRepository';
import { Manifest } from './Manifest';
import { CART_CATALOG_PORT } from './public/CartCatalogPort';
import { CATALOG_READ_PORT } from './public/CatalogReadPort';
import { CHECKOUT_CATALOG_PORT } from './public/CheckoutCatalogPort';
import { EXPERIENCE_CATALOG_PORT } from './public/ExperienceCatalogPort';
import { MEMBER_CATALOG_PORT } from './public/MemberCatalogPort';
import { REFERRAL_CATALOG_PORT } from './public/ReferralCatalogPort';
import { INVENTORY_CATALOG_PORT, PROVIDER_CATALOG_PORT, RISK_CATALOG_PORT } from './public';
import { createJobs, createProviderJobs } from './interface/job/JobFactory';

export const CatalogModule = defineModule(Manifest, {
  jobs: createJobs,
  providerJobs: createProviderJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const scopes = new CatalogScopeReader(context.ports.get(ORGANIZATION_READ_PORT));
    const pools = new PgPoolRepository(transactions, scopes);
    const products = new PgProductRepository(transactions, scopes, context.ports.get(CATALOG_PARTNER_PORT), context.ports.get(CATALOG_INVENTORY_PORT), context.ports.get(CATALOG_PRICING_PORT));
    const listings = new PgListingRepository(transactions, scopes);
    const imports = new PgCatalogImportRepository(transactions);
    const objects = context.service(OBJECT_STORE);
    return [
      new PoolsReadHandler(pools),
      new PoolsAttachHandler(pools),
      new PoolsDetachHandler(pools),
      new PoolsAllocateHandler(pools),
      new ProductDetailReadHandler(products),
      new ProductsCreateHandler(products),
      new ProductsUpdateHandler(products),
      new ProductsArchiveHandler(products),
      new ListingsReadHandler(listings),
      new ListingsPublishHandler(listings),
      new ListingsUnpublishHandler(listings),
      new ListingsBatchHandler(listings),
      new ImportsCreateHandler(imports, new PgJobScheduler(transactions), new ImportObjectService(objects)),
      new ImportsReadHandler(imports, objects),
    ];
  },
  ports: (context) => [
    { token: REFERRAL_CATALOG_PORT, value: new PgReferralCatalogPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
    { token: CART_CATALOG_PORT, value: new PgCartCatalogPort() },
    { token: CHECKOUT_CATALOG_PORT, value: new PgCheckoutCatalogPort() },
    { token: EXPERIENCE_CATALOG_PORT, value: new PgExperienceCatalogPort() },
    { token: CATALOG_READ_PORT, value: new PgCatalogReadPort() },
    { token: MEMBER_CATALOG_PORT, value: new PgMemberCatalogPort() },
  ],
  jobPorts: [
    { token: RISK_CATALOG_PORT, value: new CatalogRiskDecisionService() },
    { token: INVENTORY_CATALOG_PORT, value: new PgCatalogSku() },
  ],
  providerPorts: [{ token: PROVIDER_CATALOG_PORT, value: new CatalogSourcePort() }],
});
import { ImportObjectService } from '../../foundation/application/ImportObjectService';
