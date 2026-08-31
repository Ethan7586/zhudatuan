import { defineModule } from '../../bootstrap/DefinedModule';
import { catalogOperations } from './CatalogOperations';
import { Manifest } from './Manifest';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { PgReferralCatalogPort, REFERRAL_CATALOG_PORT } from './public/ReferralCatalogPort';
import { CART_CATALOG_PORT, PgCartCatalogPort } from './public/CartCatalogPort';
import { CHECKOUT_CATALOG_PORT, PgCheckoutCatalogPort } from './public/CheckoutCatalogPort';
import { EXPERIENCE_CATALOG_PORT, PgExperienceCatalogPort } from './public/ExperienceCatalogPort';
import { CATALOG_READ_PORT, PgCatalogReadPort } from './public/CatalogReadPort';
import { MEMBER_CATALOG_PORT, PgMemberCatalogPort } from './public/MemberCatalogPort';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
export const CatalogModule = defineModule(Manifest, catalogOperations, (context) => [
  { token: REFERRAL_CATALOG_PORT, value: new PgReferralCatalogPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
  { token: CART_CATALOG_PORT, value: new PgCartCatalogPort() },
  { token: CHECKOUT_CATALOG_PORT, value: new PgCheckoutCatalogPort() },
  { token: EXPERIENCE_CATALOG_PORT, value: new PgExperienceCatalogPort() },
  { token: CATALOG_READ_PORT, value: new PgCatalogReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
  { token: MEMBER_CATALOG_PORT, value: new PgMemberCatalogPort() },
]);
