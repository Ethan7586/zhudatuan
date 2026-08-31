import type { ScopeKind } from './ScopeKind';

export interface Scope {
  readonly kind: ScopeKind;
  readonly id: string;
  readonly tenant?: string;
  readonly path: readonly Readonly<{ kind: ScopeKind; id: string }>[];
}

export interface ScopeGrant {
  readonly effect: 'allow' | 'deny';
  readonly scope: Scope;
  readonly effective: string;
  readonly expires: string | null;
}
