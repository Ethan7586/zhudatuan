import { createHash } from 'node:crypto';

export interface GrantRole {
  readonly id: string;
  readonly version: number;
  readonly kind: 'custom' | 'system' | 'owner';
  readonly expiresAt: string | null;
}
export interface GrantPermission {
  readonly code: string;
  readonly effect: 'allow' | 'deny';
  readonly role: string;
  readonly roleVersion: number;
}
export interface GrantScope {
  readonly id: string;
  readonly kind: string;
  readonly scope: string;
  readonly path: string;
  readonly effect: 'allow' | 'deny';
  readonly version: number;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
}

export class GrantPlan {
  constructor(
    readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier',
    readonly organization: string,
    readonly membership: string | null,
    readonly principal: string | null,
    readonly roles: readonly GrantRole[],
    readonly permissions: readonly GrantPermission[],
    readonly scopes: readonly GrantScope[],
    readonly minimumAssurance: 1 | 2 | 3,
    readonly policy: string | null,
    readonly termsHash: string | null
  ) {}

  impact(): Readonly<{ people: number; scopes: number; allows: number; denies: number }> {
    const effective = new Map<string, 'allow' | 'deny'>();
    for (const permission of this.permissions) {
      if (permission.effect === 'deny' || !effective.has(permission.code)) effective.set(permission.code, permission.effect);
    }
    return Object.freeze({
      people: this.membership === null ? 0 : 1,
      scopes: new Set(this.scopes.map((scope) => `${scope.kind}:${scope.scope}`)).size,
      allows: [...effective.values()].filter((effect) => effect === 'allow').length,
      denies: [...effective.values()].filter((effect) => effect === 'deny').length,
    });
  }

  digest(): string {
    const value = {
      target: this.target,
      organization: this.organization,
      membership: this.membership,
      principal: this.principal,
      roles: [...this.roles].sort(by('id')),
      permissions: [...this.permissions].sort(by('code', 'effect', 'role')),
      scopes: [...this.scopes].sort(by('kind', 'scope', 'effect', 'id')),
      minimumAssurance: this.minimumAssurance,
      policy: this.policy,
      termsHash: this.termsHash,
    };
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}

function by<T>(...keys: readonly (keyof T)[]): (left: T, right: T) => number {
  return (left, right) => {
    for (const key of keys) {
      const compared = String(left[key]).localeCompare(String(right[key]));
      if (compared !== 0) return compared;
    }
    return 0;
  };
}
