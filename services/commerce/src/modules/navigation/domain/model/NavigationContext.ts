import type { NavigationScopeKind } from '@shop/authz';
import type { OperationTarget } from '@shop/contract';

export interface NavigationScopeValue {
  readonly membership: string;
  readonly id: string;
  readonly kind: NavigationScopeKind;
  readonly status: string;
  readonly version: number;
  readonly default: boolean;
}

export interface NavigationContextValue {
  readonly target: OperationTarget;
  readonly principal: string;
  readonly membership: string;
  readonly membershipActive: boolean;
  readonly assurance: number;
  readonly scope: NavigationScopeValue;
  readonly scopes: readonly NavigationScopeValue[];
  readonly permissions: ReadonlySet<string>;
  readonly capabilities: ReadonlySet<string>;
  readonly featureFlags: ReadonlySet<string>;
  readonly accessVersion: number;
  readonly capabilityVersion: number;
}

export class NavigationContext implements NavigationContextValue {
  readonly target: OperationTarget;
  readonly principal: string;
  readonly membership: string;
  readonly membershipActive: boolean;
  readonly assurance: number;
  readonly scope: NavigationScopeValue;
  readonly scopes: readonly NavigationScopeValue[];
  readonly permissions: ReadonlySet<string>;
  readonly capabilities: ReadonlySet<string>;
  readonly featureFlags: ReadonlySet<string>;
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
    this.featureFlags = new Set(value.featureFlags);
    this.accessVersion = value.accessVersion;
    this.capabilityVersion = value.capabilityVersion;
    Object.freeze(this);
  }

  get scopeKind(): NavigationScopeKind {
    return this.scope.kind;
  }
}
