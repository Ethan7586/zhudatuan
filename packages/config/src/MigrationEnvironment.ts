import { bearerToken, distinctValues, enumValue, requiredValue, type EnvironmentSource } from './Environment';
import { MIGRATION_APPROVAL } from './Release';

export interface MigrationEnvironment {
  readonly approval: typeof MIGRATION_APPROVAL;
  readonly databaseConnectionRef: string;
  readonly directory: string;
  readonly distributorKeyRef: string;
  readonly identityKeyRef: string;
  readonly kmsEndpoint: string;
  readonly kmsBearerToken: string;
  readonly partnerKeyRef: string;
  readonly secretStoreEndpoint: string;
  readonly secretStoreBearerToken: string;
  readonly snapshotRef: string;
  readonly voucherKeyRef: string;
}

export function migrationEnvironment(source: EnvironmentSource): MigrationEnvironment {
  const kmsBearerToken = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  return Object.freeze({
    approval: enumValue(source.MIGRATION_APPROVAL, [MIGRATION_APPROVAL] as const, 'MIGRATION_APPROVAL_INVALID'),
    databaseConnectionRef: requiredValue(source.MIGRATION_DATABASE_CONNECTION_REF, 'MIGRATION_DATABASE_CONNECTION_REF_MISSING'),
    directory: requiredValue(source.MIGRATION_DIRECTORY, 'MIGRATION_DIRECTORY_MISSING'),
    distributorKeyRef: requiredValue(source.MIGRATION_DISTRIBUTOR_KEY_REF, 'MIGRATION_DISTRIBUTOR_KEY_REF_MISSING'),
    identityKeyRef: requiredValue(source.MIGRATION_IDENTITY_KEY_REF, 'MIGRATION_IDENTITY_KEY_REF_MISSING'),
    kmsEndpoint: requiredValue(source.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'),
    kmsBearerToken,
    partnerKeyRef: requiredValue(source.MIGRATION_PARTNER_KEY_REF, 'MIGRATION_PARTNER_KEY_REF_MISSING'),
    secretStoreEndpoint: requiredValue(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    secretStoreBearerToken,
    snapshotRef: requiredValue(source.MIGRATION_SOURCE_SNAPSHOT_REF, 'MIGRATION_SOURCE_SNAPSHOT_REF_MISSING'),
    voucherKeyRef: requiredValue(source.MIGRATION_VOUCHER_KEY_REF, 'MIGRATION_VOUCHER_KEY_REF_MISSING'),
  });
}
