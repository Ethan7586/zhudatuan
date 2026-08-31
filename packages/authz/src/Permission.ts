import type { ScopeKind } from './ScopeKind';

export type PermissionRisk = 'low' | 'elevated' | 'high' | 'critical';
export type Permission = string;

export interface PermissionDefinition {
  readonly code: Permission;
  readonly module: string;
  readonly category: string;
  readonly risk: PermissionRisk;
  readonly minimumAssurance: 1 | 2 | 3;
  readonly delegatable: boolean;
  readonly allowedScopeKinds: readonly ScopeKind[];
  readonly makerChecker: boolean;
  readonly description: string;
}
