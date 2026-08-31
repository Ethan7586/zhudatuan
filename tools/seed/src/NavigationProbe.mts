import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from './LocalSecrets';
import { PgNavigationIdentity } from '../../../services/commerce/src/modules/identity/infrastructure/PgNavigationIdentity';
import { PgNavigationAccess } from '../../../services/commerce/src/modules/access/infrastructure/PgNavigationAccess';
import { PgNavigationOrganization } from '../../../services/commerce/src/modules/organization/infrastructure/PgNavigationOrganization';
import { PgNavigationCapability } from '../../../services/commerce/src/modules/capability/infrastructure/PgNavigationCapability';
import { NavigationProjector } from '../../../services/commerce/src/modules/navigation/application/projection/NavigationProjector';
import { NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH } from '../../../services/commerce/src/modules/navigation/infrastructure/catalog/NavigationCatalog';

const environment = localSeedEnvironment();
const connectionString = await localSecret(environment.adminDatabaseConnectionRef);
const database = new Client({ connectionString });
await database.connect();
try {
  const projector = new NavigationProjector(
    new PgNavigationIdentity(),
    new PgNavigationAccess(),
    new PgNavigationOrganization(),
    new PgNavigationCapability(),
    { now: () => new Date() },
    'n'.repeat(32),
    NAVIGATION_CATALOG,
    NAVIGATION_CATALOG_HASH
  );
  const tree = await projector.project(
    database as never,
    {
      actor: {
        id: 'principal:zhudatuan:owner:ethan:v1',
        session: 'session:probe',
        membership: 'membership-platform-owner-ethan-v1',
        credentialVersion: 1,
        accessVersion: 14,
        target: 'console',
        assurance: { level: 3, verified: new Date() },
      },
      membership: { id: 'membership-platform-owner-ethan-v1', active: true, accessVersion: 14, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
      scope: { id: 'organization-platform-root', kind: 'platform', path: [] },
      accessVersion: 14,
      capabilities: new Set(),
      capabilityVersion: 3,
      assurance: { level: 3, verified: new Date() },
      trace: 'trace:probe',
    },
    'organization-platform-root'
  );
  process.stdout.write(JSON.stringify(tree.tree));
} catch (cause) {
  process.stderr.write(cause instanceof Error ? `${cause.stack}\n` : `${String(cause)}\n`);
  process.exitCode = 1;
} finally {
  await database.end();
}
