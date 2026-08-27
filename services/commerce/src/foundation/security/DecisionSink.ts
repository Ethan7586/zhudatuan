import type { Actor } from './AccessContext';
import type { Scope } from '@shop/authz';

export interface AccessDecision {
  readonly actor: Actor;
  readonly operation: string;
  readonly resource?: string;
  readonly scope?: Scope;
  readonly outcome: 'allow' | 'deny' | 'challenge' | 'review';
  readonly reason: string;
  readonly trace: string;
}

export interface DecisionSink {
  append(decision: AccessDecision): Promise<void>;
}
