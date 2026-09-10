// Generated from config/identityproviders.yml and infrastructure/network/Edge.yml. Do not edit.
export const IDENTITY_PROVIDER_CHECKSUM = 'f26bc21a7d84f97d431563fbca677055c888f74b77795e00d28c66010f742e9b' as const;

export const IDENTITY_PROVIDER_TYPES = Object.freeze(["oidc","wechat","wecomcorp","wecomsuite"] as const);
export type IdentityProviderType = (typeof IDENTITY_PROVIDER_TYPES)[number];

export const IDENTITY_PROVIDER_CONFIGURATION = Object.freeze({
  schemaVersion: 3,
  schema: Object.freeze({
  "provider": {
    "required": [
      "id",
      "type",
      "issuer",
      "audiences",
      "clientId",
      "secretRef",
      "keyVersion",
      "enabled"
    ],
    "issuer": "httpsurl",
    "audiences": "nonemptyunique",
    "clientId": "publicidentifier",
    "secretRef": "secretreference",
    "keyVersion": "positiveinteger"
  },
  "wechatapplication": {
    "required": [
      "scene",
      "appId",
      "secretRef",
      "keyVersion"
    ],
    "scenes": [
      "miniapp",
      "jsapi"
    ],
    "appId": "wechatapplicationid",
    "secretRef": "secretreference",
    "keyVersion": "positiveinteger"
  }
} as const),
  callbackOrigin: 'https://passport.yengze.press',
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
  redirectAllowlist: Object.freeze(["https://passport.yengze.press"] as const),
  bindingConflict: 'reject',
  accountLink: 'explicitproof',
  keyRotationDays: 90,
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
