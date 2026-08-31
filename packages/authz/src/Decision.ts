import type { Scope } from './Scope';

export type DenialReason = 'MEMBERSHIP_INACTIVE' | 'ACCESS_VERSION_STALE' | 'EXPLICIT_DENY' | 'PERMISSION_MISSING' | 'SCOPE_DENIED' | 'SCOPE_KIND_DENIED' | 'STEPUP_REQUIRED';

export interface DecisionEvidence {
  readonly membership: string;
  readonly permission: string;
  readonly scope: Scope;
  readonly accessVersion: number;
}

export type Decision = Readonly<{ allowed: true; evidence: DecisionEvidence }> | Readonly<{ allowed: false; reason: DenialReason }>;
