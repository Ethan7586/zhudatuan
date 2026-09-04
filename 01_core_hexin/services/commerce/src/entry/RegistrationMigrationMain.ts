import { processEnvironment, registrationMigrationEnvironment } from '@shop/config/server';

import { KmsClient } from '../foundation/infrastructure/KmsClient';
import { RegistrationMigrationRunner } from '../foundation/infrastructure/RegistrationMigrationRunner';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { createPool } from '../foundation/persistence/Pool';

const environment = registrationMigrationEnvironment(processEnvironment());
const secrets = new WorkloadSecretStore(environment.secretStoreEndpoint, environment.secretStoreBearerToken);
const connection = await secrets.read(environment.databaseConnectionRef);
const pool = createPool(connection, 'migration');
const runner = new RegistrationMigrationRunner(pool, new KmsClient(environment.kmsEndpoint, environment.kmsBearerToken), environment.directory, {
  distributorKeyRef: environment.distributorKeyRef,
  identityKeyRef: environment.identityKeyRef,
  partnerKeyRef: environment.partnerKeyRef,
  voucherKeyRef: environment.voucherKeyRef,
});

try {
  await runner.run();
} finally {
  await pool.end();
}
