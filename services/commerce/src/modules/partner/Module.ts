import { PgCatalogPartnerPort } from './infrastructure/persistence/PgCatalogPartnerPort';

import { defineModule } from '../../composition/DefinedModule';
import { Manifest } from './Manifest';
import { PartnerPort } from './infrastructure/persistence/PartnerPort';
import { ACCESS_PARTNER_PORT } from './public';
import { CATALOG_PARTNER_PORT } from './public/CatalogPartnerPort';
import { PartnersReadHandler } from './application/handler/PartnersReadHandler';
import { PartnersManageHandler } from './application/handler/PartnersManageHandler';
import { StoresReadHandler } from './application/handler/StoresReadHandler';
import { StoresManageHandler } from './application/handler/StoresManageHandler';
import { PgPartnerRepository } from './infrastructure/persistence/PgPartnerRepository';
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { ORGANIZATION_HIERARCHY_PORT } from '../organization/public/HierarchyPort';
import { KMS_CLIENT } from '../../pipeline/KmsPort';
import { CustomersCreateHandler } from './application/handler/CustomersCreateHandler';
import { CustomersDisableHandler } from './application/handler/CustomersDisableHandler';
import { CustomersEnableHandler } from './application/handler/CustomersEnableHandler';
import { CustomersGetHandler } from './application/handler/CustomersGetHandler';
import { CustomersListHandler } from './application/handler/CustomersListHandler';
import { CustomersUpdateHandler } from './application/handler/CustomersUpdateHandler';
import { CustomerOptionsHandler } from './application/handler/CustomerOptionsHandler';
import { ChangeCustomerState } from './application/process/ChangeCustomerState';
import { ProtectCustomerData } from './application/process/ProtectCustomerData';
import { PgCustomerRepository } from './infrastructure/persistence/PgCustomerRepository';
import { VOUCHER_CUSTOMER_PORT } from './public/VoucherCustomerPort';
export const PartnerModule = defineModule(Manifest, {
  handlers: (context) => {
    const partners = new PgPartnerRepository(new PgTransactionAccess());
    const customers = new PgCustomerRepository(new PgTransactionAccess());
    const organizations = context.ports.get(ORGANIZATION_HIERARCHY_PORT);
    const protector = new ProtectCustomerData(context.service(KMS_CLIENT));
    const change = new ChangeCustomerState(customers);
    return [
      new PartnersReadHandler(partners, organizations),
      new PartnersManageHandler(partners),
      new StoresReadHandler(partners, organizations),
      new StoresManageHandler(partners, organizations, context.service(KMS_CLIENT)),
      new CustomersCreateHandler(customers, protector),
      new CustomersUpdateHandler(customers, protector),
      new CustomersEnableHandler(change),
      new CustomersDisableHandler(change),
      new CustomersGetHandler(customers),
      new CustomersListHandler(customers),
      new CustomerOptionsHandler(customers),
    ];
  },
  ports: [
    { token: ACCESS_PARTNER_PORT, value: new PartnerPort() },
    { token: CATALOG_PARTNER_PORT, value: new PgCatalogPartnerPort() },
    { token: VOUCHER_CUSTOMER_PORT, value: new PgCustomerRepository() },
  ],
});
