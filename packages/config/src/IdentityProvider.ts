// Generated from config/identityproviders.yml and infrastructure/network/Edge.yml. Do not edit.
export const IDENTITY_PROVIDER_CHECKSUM = 'd5cfb06ac4ac1bbb9753316e2d2192c8a10b8aa3a6a731e4818734b2768b9a8f' as const;

export const IDENTITY_PROVIDER_TYPES = Object.freeze(["oidc","wechat","wecomcorp","wecomsuite"] as const);
export type IdentityProviderType = (typeof IDENTITY_PROVIDER_TYPES)[number];

export const IDENTITY_PROVIDER_CONFIGURATION = Object.freeze({
  schemaVersion: 2,
  callbackOrigin: 'https://passport.fufu.wang',
  discoveryPath: '/.well-known/openid-configuration',
  discoveryTtlSeconds: 3600,
  jwksTtlSeconds: 900,
  clockSkewSeconds: 60,
  transactionTtlSeconds: 300,
  ticketTtlSeconds: 60,
  preauthTtlSeconds: 300,
  pkce: 'S256',
  stateBytes: 32,
  nonceBytes: 32,
  maximumProviders: 64,
  maximumScopes: 32,
  maximumResponseBytes: 1048576,
  retryAttempts: 3,
  allowedAlgorithms: Object.freeze(["RS256","ES256"] as const),
  typePolicies: Object.freeze({
  "oidc": {
    "timeoutMilliseconds": 5000,
    "circuitFailureThreshold": 5,
    "circuitRecoveryMilliseconds": 30000
  },
  "wechat": {
    "timeoutMilliseconds": 5000,
    "circuitFailureThreshold": 5,
    "circuitRecoveryMilliseconds": 30000
  },
  "wecomcorp": {
    "timeoutMilliseconds": 5000,
    "circuitFailureThreshold": 5,
    "circuitRecoveryMilliseconds": 30000
  },
  "wecomsuite": {
    "timeoutMilliseconds": 5000,
    "circuitFailureThreshold": 5,
    "circuitRecoveryMilliseconds": 30000
  }
} as const),
  secretReference: new RegExp("^[a-z][a-z0-9./]{2,127}$"),
});

export function identityCallback(provider: string): string {
  if (!/^[0-9a-f-]{36}$/.test(provider)) throw new Error('IDENTITY_PROVIDER_ID_INVALID');
  return `${IDENTITY_PROVIDER_CONFIGURATION.callbackOrigin}/api/v1/identity/federations/${provider}/callback`;
}

export function oidcIssuer(value: string): string {
  let issuer: URL;
  try { issuer = new URL(value); } catch { throw new Error('OIDC_ISSUER_INVALID'); }
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash || (issuer.port && issuer.port !== '443')) throw new Error('OIDC_ISSUER_INVALID');
  return issuer.toString().replace(/\/$/, '');
}
