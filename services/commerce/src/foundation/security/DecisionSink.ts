import type { Actor } from './AccessContext';
import type { Scope } from '@shop/authz';
import { token } from '../../bootstrap/Container';

export interface AccessDecision {
  readonly actor: Actor;
  readonly operation: string;
  readonly resource?: string;
  readonly scope?: Scope;
  readonly outcome: 'allow' | 'deny' | 'challenge' | 'review';
  readonly reason: string;
  readonly trace: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
}

export interface DecisionSink {
  append(decision: AccessDecision): Promise<void>;
}

export const DECISION_SINK = token<DecisionSink>('decision.sink');
