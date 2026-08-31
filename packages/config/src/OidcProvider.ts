export const OIDC_PROVIDER_CONFIGURATION = Object.freeze({
  discoveryPath: '/.well-known/openid-configuration',
  discoveryTtlSeconds: 3_600,
  jwksTtlSeconds: 900,
  clockSkewSeconds: 60,
  maximumResponseBytes: 1_048_576,
  allowedAlgorithms: Object.freeze(['RS256', 'ES256'] as const),
});

export function oidcIssuer(value: string): string {
  let issuer: URL;
  try {
    issuer = new URL(value);
  } catch {
    throw new Error('OIDC_ISSUER_INVALID');
  }
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash || (issuer.port && issuer.port !== '443')) {
    throw new Error('OIDC_ISSUER_INVALID');
  }
  return issuer.toString().replace(/\/$/, '');
}
