import type { MembershipAccess, Scope } from '@shop/authz';
import type { MallContext } from '../../modules/mall/MallContext';

export interface Actor {
  readonly id: string;
  readonly session: string;
  readonly membership: string;
  readonly credentialVersion: number;
  readonly accessVersion: number;
  readonly target: 'console' | 'storefront' | 'store' | 'supplier';
  readonly assurance: Readonly<{ level: number; verified?: Date }>;
}

export interface AccessContext {
  readonly actor: Actor;
  readonly membership: MembershipAccess;
  readonly scope: Scope;
  readonly mallContext?: MallContext;
  readonly mall_id?: string;
  readonly accessVersion: number;
  readonly capabilities: readonly string[];
  readonly assurance: Actor['assurance'];
  readonly trace: string;
}
