import manifest from './identity-node-manifest.json' with { type: 'json' };

export type IdentityNodeManifestProfile = 'operating_mall' | 'consumer';
export type IdentityNodeManifestEntryKind = 'accounts' | 'api' | 'storefront';
export type IdentityNodeManifestSurface = 'admin' | 'consumer';
export type IdentityNodeManifestMembershipClient = 'operator' | 'storefront' | 'store' | 'supplier';

export interface IdentityNodeManifestEntry {
  readonly host: string;
  readonly kind: IdentityNodeManifestEntryKind;
  readonly status: 'active' | 'disabled';
}

export interface IdentityNodeManifestTarget {
  readonly surface: IdentityNodeManifestSurface;
  readonly target: string;
  readonly membershipClient: IdentityNodeManifestMembershipClient;
  readonly membershipOrganizationId: string;
  readonly application: string | null;
  readonly returnOrigin: string;
}

export interface IdentityNodeManifestNode {
  readonly nodeId: string;
  readonly realmId: string;
  readonly status: 'active' | 'disabled';
  readonly nodeProfile: IdentityNodeManifestProfile;
  readonly mallId: string | null;
  readonly hostNodeId: string | null;
  readonly displayName: string;
  readonly mallName: string;
  readonly brandName: string;
  readonly accountsOrigin: string;
  readonly apiOrigin: string;
  readonly consumerApiOrigin: string;
  readonly adminOrigin: string | null;
  readonly storefrontOrigin: string;
  readonly storefrontHosts: readonly string[];
  readonly entries: readonly IdentityNodeManifestEntry[];
  readonly targets: readonly IdentityNodeManifestTarget[];
}

export interface IdentityNodeManifest {
  readonly schema: 'zhudatuan.identity-node-manifest.v1';
  readonly revision: string;
  readonly version: 2;
  readonly defaultNodeId: string;
  readonly allowedBrowserOrigins: readonly string[];
  readonly nodes: readonly IdentityNodeManifestNode[];
}

export const IDENTITY_NODE_MANIFEST = manifest as IdentityNodeManifest;
