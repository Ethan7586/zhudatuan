import type { ConsoleScopeKind } from '@shop/authz';
import type { NavigationScope } from '../../../organization/public';

export interface NavigationContextValue {
  readonly target: 'console' | 'storefront';
  readonly principal: string;
  readonly membership: string;
  readonly membershipActive: boolean;
  readonly assurance: number;
  readonly scope: NavigationScope;
  readonly scopes: readonly NavigationScope[];
  readonly permissions: ReadonlySet<string>;
  readonly capabilities: ReadonlySet<string>;
  readonly accessVersion: number;
  readonly capabilityVersion: number;
}

export class NavigationContext implements NavigationContextValue {
  readonly target: 'console' | 'storefront';
  readonly principal: string;
  readonly membership: string;
  readonly membershipActive: boolean;
  readonly assurance: number;
  readonly scope: NavigationScope;
  readonly scopes: readonly NavigationScope[];
  readonly permissions: ReadonlySet<string>;
  readonly capabilities: ReadonlySet<string>;
  readonly accessVersion: number;
  readonly capabilityVersion: number;

  constructor(value: NavigationContextValue) {
    if (!value.principal || !value.membership || value.scope.status !== 'active') throw new Error('NAVIGATION_CONTEXT_INVALID');
    this.target = value.target;
    this.principal = value.principal;
    this.membership = value.membership;
    this.membershipActive = value.membershipActive;
    this.assurance = value.assurance;
    this.scope = value.scope;
    this.scopes = Object.freeze([...value.scopes]);
    this.permissions = new Set(value.permissions);
    this.capabilities = new Set(value.capabilities);
    this.accessVersion = value.accessVersion;
    this.capabilityVersion = value.capabilityVersion;
    Object.freeze(this);
  }

  get scopeKind(): ConsoleScopeKind {
    return this.scope.kind;
  }
}
