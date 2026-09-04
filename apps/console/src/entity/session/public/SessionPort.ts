import type { ConsoleScope } from '../ConsoleSession';
import type { SessionCommandContext, StepupAction, StepupChallenge, StepupResult } from '../model/Stepup';

export interface SessionPort {
  read(signal: AbortSignal): Promise<unknown>;
  profile(accessVersion: number, signal: AbortSignal): Promise<unknown>;
  layers(scope: ConsoleScope, accessVersion: number, cursor: string | undefined, signal: AbortSignal): Promise<unknown>;
  delete(context: SessionCommandContext): Promise<unknown>;
  disableStepup(context: SessionCommandContext): Promise<Readonly<{ assurance: number }>>;
  startStepup(context: SessionCommandContext, action?: StepupAction): Promise<StepupChallenge>;
  completeStepup(context: SessionCommandContext, challenge: string, code: string): Promise<StepupResult>;
}
