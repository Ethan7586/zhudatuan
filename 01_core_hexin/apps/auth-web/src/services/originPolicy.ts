interface OriginPolicy {
  readonly allowLocalDevelopment: boolean;
  readonly canonicalOrigin: string;
  readonly configuredOrigin?: string;
  readonly deniedMessage: string;
  readonly invalidMessage: string;
  readonly stagingOrigin?: string;
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
