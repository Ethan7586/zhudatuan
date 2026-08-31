import { defineModule } from '../../bootstrap/DefinedModule';
import { organizationOperations } from './OrganizationOperations';
import { Manifest } from './Manifest';
import { OrganizationPort } from './OrganizationPort';
import { IDENTITY_ORGANIZATION_PORT } from './public/IdentityOrganizationPort';
import { CHANNEL_ORGANIZATION_PORT } from './public/index';
import { NAVIGATION_ORGANIZATION_PORT } from './public/NavigationOrganizationPort';
import { PgNavigationOrganization } from './infrastructure/PgNavigationOrganization';
import { ACCESS_ORGANIZATION_PORT } from './public/AccessOrganizationPort';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { ORGANIZATION_READ_PORT, PgOrganizationReadPort } from './public';
export const OrganizationModule = defineModule(Manifest, organizationOperations, (context) => {
  const organization = new OrganizationPort();
  return [
    { token: IDENTITY_ORGANIZATION_PORT, value: organization },
    { token: ACCESS_ORGANIZATION_PORT, value: organization },
    { token: CHANNEL_ORGANIZATION_PORT, value: organization },
    { token: NAVIGATION_ORGANIZATION_PORT, value: new PgNavigationOrganization() },
    { token: ORGANIZATION_READ_PORT, value: new PgOrganizationReadPort() },
  ];
});
