import type { ScopeKind } from './ScopeKind';

export interface Scope {
  readonly kind: ScopeKind;
  readonly id: string;
  readonly tenant?: string;
  readonly path: readonly Readonly<{ kind: ScopeKind; id: string }>[];
}

export interface ScopeGrant {
  readonly scope: Scope;
  readonly permissions: readonly string[];
  readonly effective: string;
  readonly expires: string | null;
}
