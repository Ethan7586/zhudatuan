export const IDENTITY_PROVIDER_TYPES = Object.freeze(['wechat', 'wecomcorp', 'wecomsuite', 'oidc'] as const);
export type IdentityProviderType = (typeof IDENTITY_PROVIDER_TYPES)[number];

export const IDENTITY_PROVIDER_CONFIGURATION = Object.freeze({
  schemaVersion: 1,
  callbackBases: Object.freeze(['https://auth.zhuda.example'] as const),
  transactionTtlSeconds: 300,
  preauthTtlSeconds: 300,
  stateBytes: 32,
  nonceBytes: 32,
  maximumProviders: 64,
  maximumScopes: 32,
  timeoutMilliseconds: 5_000,
  circuitFailureThreshold: 5,
  circuitRecoveryMilliseconds: 30_000,
  retryAttempts: 3,
  allowedAlgorithms: Object.freeze(['RS256', 'ES256'] as const),
  secretReference: /^[a-z][a-z0-9./]{2,127}$/,
});

export function identityCallback(provider: string): string {
  if (!/^[0-9a-f-]{36}$/.test(provider)) throw new Error('IDENTITY_PROVIDER_ID_INVALID');
  return `${IDENTITY_PROVIDER_CONFIGURATION.callbackBases[0]}/api/v1/identity/federations/${provider}/callback`;
}
