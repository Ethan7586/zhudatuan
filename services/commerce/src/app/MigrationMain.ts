import { migrationEnvironment, processEnvironment } from '@shop/config/server';
import { HttpKmsClient } from '../foundation/infrastructure/KmsClient';
import { MigrationRunner } from '../foundation/infrastructure/MigrationRunner';
import { secretText, WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { createPool } from '../foundation/persistence/Pool';

const environment = migrationEnvironment(processEnvironment());
if (!/^[a-z0-9][a-z0-9/._:-]{7,511}$/i.test(environment.snapshotRef)) throw new Error('MIGRATION_SOURCE_SNAPSHOT_REF_INVALID');

const secrets = new WorkloadSecretStore(environment.secretStoreEndpoint, environment.secretStoreBearerToken);
const connection = await secretText(secrets, environment.databaseConnectionRef, 'database');
const pool = createPool(connection, 'migration');
const runner = new MigrationRunner(pool, new HttpKmsClient(environment.kmsEndpoint, environment.kmsBearerToken), environment.directory, {
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
