import { bearerToken, requiredValue, type EnvironmentSource } from './Environment';

export interface ProviderCatalogEnvironment {
  readonly databaseConnectionRef: string;
  readonly manifestPrivateKeyFile: string;
  readonly manifestPublicKeyFile: string;
  readonly secretStoreBearerToken: string;
  readonly secretStoreEndpoint: string;
}

export function providerCatalogEnvironment(source: EnvironmentSource): ProviderCatalogEnvironment {
  return Object.freeze({
    databaseConnectionRef: requiredValue(source.MIGRATION_DATABASE_CONNECTION_REF, 'MIGRATION_DATABASE_CONNECTION_REF_MISSING'),
    manifestPrivateKeyFile: requiredValue(source.PROVIDER_MANIFEST_PRIVATE_KEY_FILE, 'PROVIDER_MANIFEST_PRIVATE_KEY_FILE_MISSING'),
    manifestPublicKeyFile: requiredValue(source.PROVIDER_MANIFEST_PUBLIC_KEY_FILE, 'PROVIDER_MANIFEST_PUBLIC_KEY_FILE_MISSING'),
    secretStoreBearerToken: bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID'),
    secretStoreEndpoint: requiredValue(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
  });
}
