import type { AuthTarget } from './ClientEnvironment';

export type IdentityRealmSurface = 'admin' | 'consumer';
export type IdentityMembershipClient = 'operator' | 'storefront' | 'store' | 'supplier';

export interface IdentityRealmContext {
  readonly nodeId: string;
  readonly surface: IdentityRealmSurface;
  readonly entryHost: string;
  readonly target: AuthTarget;
  readonly membershipClient: IdentityMembershipClient;
  readonly membershipOrganizationId: string;
  readonly application?: string;
}

interface IdentityNodeDefinition {
  readonly nodeId: string;
  readonly entryHosts: readonly string[];
  readonly admin: Readonly<{
    targets: readonly AuthTarget[];
    membershipOrganizationId: string;
  }>;
  readonly consumer: Readonly<{
    target: AuthTarget;
    membershipOrganizationId: string;
    application: string;
  }>;
}

const IDENTITY_NODES = Object.freeze([
  Object.freeze({
    nodeId: 'l0',
    entryHosts: Object.freeze(['accounts.zhudatuan.com', 'api.zhudatuan.com', 'localhost', '127.0.0.1']),
    admin: Object.freeze({
      targets: Object.freeze<AuthTarget[]>(['console', 'store', 'supplier']),
      membershipOrganizationId: 'tenant-zhudatuan',
    }),
    consumer: Object.freeze({
      target: 'storefront',
      membershipOrganizationId: 'mall-zhudatuan',
      application: 'zhudatuan-storefront',
    }),
  }),
  Object.freeze({
    nodeId: 'l1',
    entryHosts: Object.freeze(['accounts.hbbtzn.com', 'api.hbbtzn.com', 'hbbtzn.com']),
    admin: Object.freeze({
      targets: Object.freeze<AuthTarget[]>(['console-hbbtzn']),
      membershipOrganizationId: 'mall:d1708f04df2dd8a61736852c4900fb43',
    }),
    consumer: Object.freeze({
      target: 'storefront-hbbtzn',
      membershipOrganizationId: 'mall:d1708f04df2dd8a61736852c4900fb43',
      application: 'zdt-l1-verify',
    }),
  }),
] as const satisfies readonly IdentityNodeDefinition[]);

export function resolveIdentityRealm(
  hostHeader: string | undefined,
  target: AuthTarget,
  application?: string,
): IdentityRealmContext {
  const entryHost = identityEntryHost(hostHeader);
  const node = IDENTITY_NODES.find((candidate) => candidate.entryHosts.includes(entryHost));
  if (!node) throw new Error('AUTH_REALM_ENTRY_INVALID');

  if ((node.admin.targets as readonly AuthTarget[]).includes(target)) {
    if (application !== undefined) throw new Error('AUTH_REALM_MISMATCH');
    return Object.freeze({
      nodeId: node.nodeId,
      surface: 'admin',
      entryHost,
      target,
      membershipClient: membershipClient(target),
      membershipOrganizationId: node.admin.membershipOrganizationId,
    });
  }

  if (target !== node.consumer.target || application !== node.consumer.application) {
    throw new Error('AUTH_REALM_MISMATCH');
  }
  return Object.freeze({
    nodeId: node.nodeId,
    surface: 'consumer',
    entryHost,
    target,
    membershipClient: 'storefront',
    membershipOrganizationId: node.consumer.membershipOrganizationId,
    application: node.consumer.application,
  });
}

export function identityEntryHost(value: string | undefined): string {
  const host = value?.trim().toLowerCase();
  if (!host || host.includes('/') || host.includes('@')) throw new Error('AUTH_REALM_ENTRY_INVALID');
  try {
    return new URL(`https://${host}`).hostname;
  } catch {
    throw new Error('AUTH_REALM_ENTRY_INVALID');
  }
}

function membershipClient(target: AuthTarget): IdentityMembershipClient {
  if (target === 'console' || target === 'console-hbbtzn') return 'operator';
  if (target === 'storefront' || target === 'storefront-hbbtzn') return 'storefront';
  return target;
}
