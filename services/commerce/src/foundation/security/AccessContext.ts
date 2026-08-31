import type { MembershipAccess, Scope } from '@shop/authz';

export interface Actor {
  readonly id: string;
  readonly session: string;
  readonly membership: string;
  readonly credentialVersion: number;
  readonly accessVersion: number;
  readonly target: 'console' | 'storefront';
  readonly assurance: Readonly<{ level: number; verified?: Date }>;
}

export interface AccessContext {
  readonly actor: Actor;
  readonly membership: MembershipAccess;
  readonly organization: string;
  readonly scope: Scope;
  readonly accessVersion: number;
  readonly capabilities: ReadonlySet<string>;
  readonly capabilityVersion: number;
  readonly assurance: Actor['assurance'];
  readonly trace: string;
}
