import type { AuthTarget } from './ClientEnvironment';

export type IdentityRealmSurface = 'admin' | 'consumer';
export type IdentityMembershipClient = 'operator' | 'storefront' | 'store' | 'supplier';

export interface IdentityRealmContext {
  readonly realmId: string;
  readonly nodeId: string;
  readonly surface: IdentityRealmSurface;
  readonly entryHost: string;
  readonly target: AuthTarget;
  readonly membershipClient: IdentityMembershipClient;
  readonly membershipOrganizationId: string;
  readonly application?: string;
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
