import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Failure } from '../domain/Failure';

export type HostResolver = (hostname: string) => Promise<readonly string[]>;

export interface NetworkTrust {
  readonly allowPrivate?: boolean;
  readonly hosts?: readonly string[];
  readonly origins?: readonly string[];
}

export class NetworkPolicy {
  private readonly hosts: ReadonlySet<string>;
  private readonly origins: ReadonlySet<string>;
  private readonly allowPrivate: boolean;

  constructor(
    trust: NetworkTrust = {},
    private readonly resolver: HostResolver = resolveHost
  ) {
    this.hosts = new Set((trust.hosts ?? []).map((host) => host.toLowerCase()));
    this.origins = new Set((trust.origins ?? []).map((origin) => new URL(origin).origin));
    this.allowPrivate = trust.allowPrivate === true;
  }

  static service(endpoint: string | URL, resolver: HostResolver = resolveHost): NetworkPolicy {
    const target = endpoint instanceof URL ? new URL(endpoint) : new URL(endpoint);
    if (target.protocol !== 'https:' || target.username || target.password || target.hash || target.search) throw new Error('NETWORK_ENDPOINT_INVALID');
    return new NetworkPolicy({ allowPrivate: true, origins: [target.origin] }, resolver);
  }

  async assert(url: string | URL): Promise<URL> {
    const target = url instanceof URL ? new URL(url) : new URL(url);
    const trustedOrigin = this.origins.has(target.origin);
    if (target.protocol !== 'https:' || target.username || target.password || target.hash) {
      throw new Error('NETWORK_ENDPOINT_INVALID');
    }
    const hostname = target.hostname.toLowerCase();
    if (this.origins.size > 0 && !trustedOrigin) throw new Error('NETWORK_ENDPOINT_DENIED');
    if (!trustedOrigin && target.port && target.port !== '443') throw new Error('NETWORK_ENDPOINT_INVALID');
    if (this.hosts.size > 0 && !this.hosts.has(hostname)) throw new Error('NETWORK_ENDPOINT_DENIED');
    const literal = isIP(hostname) ? [hostname] : await this.resolver(hostname);
    if (literal.length === 0 || (!this.allowPrivate && literal.some((address) => !publicAddress(address)))) throw new Error('NETWORK_ADDRESS_DENIED');
    return target;
  }
}

async function resolveHost(hostname: string): Promise<readonly string[]> {
  try {
    return (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
  } catch (cause) {
    throw new Failure('NETWORK_DNS_FAILED', 'unavailable', true, undefined, { cause });
  }
}

export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number, number, number];
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && b >= 18 && b <= 19));
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1' || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || /^[fd][0-9a-f]/.test(normalized)) return false;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped?.[1] ? publicAddress(mapped[1]) : true;
  }
  return false;
}
