import { requiredValue, type EnvironmentSource } from './Environment';

export interface ProviderEnvironment {
  readonly connectionId: string;
  readonly secretRef: string;
}

export function providerEnvironment(source: EnvironmentSource): ProviderEnvironment {
  return Object.freeze({
    connectionId: requiredValue(source.PROVIDER_CONNECTION_ID, 'PROVIDER_CONNECTION_ID_MISSING'),
    secretRef: requiredValue(source.PROVIDER_SECRET_REF, 'PROVIDER_SECRET_REF_MISSING'),
  });
}
