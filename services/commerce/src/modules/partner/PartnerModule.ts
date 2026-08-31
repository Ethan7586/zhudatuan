import { defineModule } from '../../bootstrap/DefinedModule';
import { partnerOperations } from './PartnerOperations';
import { Manifest } from './Manifest';
import { PartnerPort } from './PartnerPort';
import { ACCESS_PARTNER_PORT } from './public';
import { CATALOG_PARTNER_PORT, PgCatalogPartnerPort } from './public/CatalogPartnerPort';
export const PartnerModule = defineModule(Manifest, partnerOperations, [
  { token: ACCESS_PARTNER_PORT, value: new PartnerPort() },
  { token: CATALOG_PARTNER_PORT, value: new PgCatalogPartnerPort() },
]);
