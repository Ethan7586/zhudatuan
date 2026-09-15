import { createFetchIdentityStepupComplete, createFetchIdentityStepupStart } from '@shop/sdk/identity';
import { z } from 'zod';
import { consoleCommand, consoleRequest, identitySessionRead } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { SessionSchema, type ConsoleSession } from './ConsoleSession';

const stepUpStart = createFetchIdentityStepupStart(appConfig.apiBaseUrl);
const stepUpComplete = createFetchIdentityStepupComplete(appConfig.apiBaseUrl);

const StepUpChallengeSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal('stepup'),
  expires_at: z.string().min(1),
});

const StepUpCompletionSchema = z.object({
  id: z.string().min(1),
  assurance_level: z.literal(3),
});

export type StepUpChallenge = z.infer<typeof StepUpChallengeSchema>;

export async function requestStepUp(session: ConsoleSession, signal?: AbortSignal): Promise<StepUpChallenge> {
  const value = await stepUpStart(
    { body: {} },
    consoleCommand(undefined, {
      ...(signal === undefined ? {} : { signal }),
      accessVersion: session.accessVersion,
      ...(session.csrf === undefined ? {} : { csrfToken: session.csrf }),
    })
  );
  return StepUpChallengeSchema.parse(value);
}

export async function completeStepUpAndReadSession(current: ConsoleSession, challenge: string, code: string, signal?: AbortSignal): Promise<ConsoleSession> {
  const completed = await stepUpComplete(
    { body: { challenge, code } },
    consoleCommand(undefined, {
      ...(signal === undefined ? {} : { signal }),
      accessVersion: current.accessVersion,
      ...(current.csrf === undefined ? {} : { csrfToken: current.csrf }),
    })
  );
  StepUpCompletionSchema.parse(completed);
  const refreshed = SessionSchema.parse(await identitySessionRead({}, consoleRequest(undefined, signal)));
  if (refreshed.actor !== current.actor || refreshed.membership !== current.membership || refreshed.assurance.level < 3) {
    throw new Error('STEP_UP_SESSION_RECEIPT_INVALID');
  }
  return refreshed;
}
