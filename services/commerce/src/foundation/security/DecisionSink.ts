import type { Actor } from './AccessContext';
import type { Scope } from '@shop/authz';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { token } from '../../bootstrap/Container';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { token } from '../../bootstrap/Container';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD

export const DECISION_SINK = token<DecisionSink>('decision.sink');
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======

export const DECISION_SINK = token<DecisionSink>('decision.sink');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
