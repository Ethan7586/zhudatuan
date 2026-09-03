import type { AuthTarget } from '@shop/config/client';

export interface Membership {
  readonly id: string;
  readonly target: AuthTarget;
  readonly displayName: string;
  readonly organizationName: string;
  readonly scopeKind: string;
  readonly scopeId: string;
  readonly roleLabel: string;
  readonly logoUrl?: string | null;
}

export interface MembershipSelection {
  readonly memberships: readonly Membership[];
  readonly expiresAt: string;
  readonly target: AuthTarget;
}
