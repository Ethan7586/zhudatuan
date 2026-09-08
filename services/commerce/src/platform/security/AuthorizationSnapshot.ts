import type { MembershipAccess, Scope } from '@shop/authz';
import type { Actor } from './AccessContext';

export interface AuthorizationRole {
  readonly id: string;
  readonly kind: 'custom' | 'system' | 'owner';
  readonly status: 'active' | 'disabled';
  readonly version: number;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly active: boolean;
}

export interface AuthorizationSnapshot {
  readonly membership: MembershipAccess;
  readonly credentialVersion: number;
  readonly organization: string;
  readonly target: Actor['target'];
  readonly roles: readonly AuthorizationRole[];
  readonly scope: Scope;
  readonly capabilities: ReadonlySet<string>;
  readonly capabilityVersion: number;
}

export interface AuthorizationSnapshotResolver {
  resolve(
    actor: Actor,
    operation: string,
    options: Readonly<{ resource?: string | undefined; deadline: number; signal: AbortSignal }>
  ): Promise<AuthorizationSnapshot>;
}
