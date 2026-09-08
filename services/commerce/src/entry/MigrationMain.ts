import { migrationEnvironment, processEnvironment } from '@shop/config/server';
import { HttpKmsClient } from '../platform/crypto/KmsClient';
import { MigrationRunner } from '../platform/database/MigrationRunner';
import { secretText, WorkloadSecretStore } from '../platform/secret/SecretStore';
import { createPool } from '../platform/database/Pool';

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
  await runner.run(environment.phase);
} finally {
  await pool.end();
}
