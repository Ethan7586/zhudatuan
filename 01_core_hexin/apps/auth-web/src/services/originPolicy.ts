interface OriginPolicy {
  readonly allowLocalDevelopment: boolean;
  readonly canonicalOrigin: string;
  readonly configuredOrigin?: string;
  readonly deniedMessage: string;
  readonly invalidMessage: string;
  readonly stagingOrigin?: string;
}

const CANONICAL_ADMIN_LOGIN_ORIGIN = 'https://console.zhudatuan.com';
const HONGTAI_ADMIN_LOGIN_ORIGIN = 'https://console.hbbtzn.com';
const CANONICAL_STOREFRONT_LOGIN_ORIGIN = 'https://hbbtzn.com';
const LEGACY_STOREFRONT_LOGIN_ORIGIN = 'https://zhudatuan.com';

export function resolveAdminLoginOrigin(configuredOrigin?: string, allowLocalDevelopment = false): string {
  return resolveCredentialTargetOrigin(
    configuredOrigin,
    CANONICAL_ADMIN_LOGIN_ORIGIN,
    '后台',
    allowLocalDevelopment,
    [HONGTAI_ADMIN_LOGIN_ORIGIN],
  );
}

export function resolveStorefrontLoginOrigin(configuredOrigin?: string, allowLocalDevelopment = false): string {
  return resolveCredentialTargetOrigin(
    configuredOrigin,
    CANONICAL_STOREFRONT_LOGIN_ORIGIN,
    '商城',
    allowLocalDevelopment,
    [LEGACY_STOREFRONT_LOGIN_ORIGIN],
  );
}

export function resolveBuildTimeOrigin(policy: OriginPolicy): string {
  const canonical = exactHttpsOrigin(policy.canonicalOrigin, policy.invalidMessage);
  const staging = optionalStagingOrigin(policy.stagingOrigin, policy.invalidMessage);
  const selected = parseOrigin(policy.configuredOrigin?.trim() || canonical, policy.invalidMessage);
  const local = policy.allowLocalDevelopment
    && selected.protocol === 'http:'
    && (selected.hostname === '127.0.0.1' || selected.hostname === 'localhost');
  if (!originOnly(selected)) throw new Error(policy.invalidMessage);
  if (!local && selected.protocol !== 'https:') throw new Error(policy.deniedMessage);
  if (!local && selected.origin !== canonical && selected.origin !== staging) throw new Error(policy.deniedMessage);
  return selected.origin;
}

function resolveCredentialTargetOrigin(
  configuredOrigin: string | undefined,
  canonicalOrigin: string,
  targetLabel: string,
  allowLocalDevelopment: boolean,
  compatibleOrigins: readonly string[] = [],
): string {
  let parsed: URL;
  try {
    parsed = new URL(configuredOrigin?.trim() || canonicalOrigin);
  } catch {
    throw new Error(`${targetLabel}登录目标配置无效，已停止提交账号凭证`);
  }

  const isCanonical = parsed.origin === canonicalOrigin || compatibleOrigins.includes(parsed.origin);
  const isLocalDevelopment = allowLocalDevelopment
    && parsed.protocol === 'http:'
    && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if ((!isCanonical && !isLocalDevelopment) || parsed.username || parsed.password) {
    throw new Error(`${targetLabel}登录目标不在允许清单，已停止提交账号凭证`);
  }

  return parsed.origin;
}

function optionalStagingOrigin(value: string | undefined, message: string): string | undefined {
  const selected = value?.trim();
  return selected ? exactHttpsOrigin(selected, message) : undefined;
}

function exactHttpsOrigin(value: string, message: string): string {
  const parsed = parseOrigin(value, message);
  if (parsed.protocol !== 'https:' || !originOnly(parsed)) throw new Error(message);
  return parsed.origin;
}

function parseOrigin(value: string, message: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(message);
  }
}

function originOnly(value: URL): boolean {
  return !value.username && !value.password && (value.pathname === '/' || value.pathname === '') && !value.search && !value.hash;
}
