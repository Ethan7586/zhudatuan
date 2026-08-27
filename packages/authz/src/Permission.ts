import type { ScopeKind } from './ScopeKind';

export type PermissionRisk = 'low' | 'elevated' | 'high' | 'critical';
export type Permission = string;

export interface PermissionDefinition {
  readonly code: Permission;
  readonly category: string;
  readonly risk: PermissionRisk;
  readonly stepup: boolean;
  readonly scopes: readonly ScopeKind[];
}
