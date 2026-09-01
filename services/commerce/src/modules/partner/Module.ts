import { PgCatalogPartnerPort } from './infrastructure/persistence/PgCatalogPartnerPort';

import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { PartnerPort } from './infrastructure/persistence/PartnerPort';
import { ACCESS_PARTNER_PORT } from './public';
import { CATALOG_PARTNER_PORT } from './public/CatalogPartnerPort';
import { PartnersReadHandler } from './application/handler/PartnersReadHandler';
import { PartnersManageHandler } from './application/handler/PartnersManageHandler';
import { StoresReadHandler } from './application/handler/StoresReadHandler';
import { StoresManageHandler } from './application/handler/StoresManageHandler';
import { PgPartnerRepository } from './infrastructure/persistence/PgPartnerRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { ORGANIZATION_HIERARCHY_PORT } from '../organization/public/HierarchyPort';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
export const PartnerModule = defineModule(Manifest, {
  handlers: (context) => {
    const partners = new PgPartnerRepository(new PgTransactionAccess());
    const organizations = context.ports.get(ORGANIZATION_HIERARCHY_PORT);
    return [new PartnersReadHandler(partners, organizations), new PartnersManageHandler(partners), new StoresReadHandler(partners, organizations), new StoresManageHandler(partners, organizations, context.service(KMS_CLIENT))];
  },
  ports: [
    { token: ACCESS_PARTNER_PORT, value: new PartnerPort() },
    { token: CATALOG_PARTNER_PORT, value: new PgCatalogPartnerPort() },
  ],
});
