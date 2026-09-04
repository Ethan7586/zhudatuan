import { CompleteStepup } from '../../entity/session/application/CompleteStepup';
import { DeleteSession } from '../../entity/session/application/DeleteSession';
import { DisableStepup } from '../../entity/session/application/DisableStepup';
import { StartStepup } from '../../entity/session/application/StartStepup';
import type { SessionPort } from '../../entity/session/public/SessionPort';
import { createIdempotencyKey } from '@shop/sdk/context';
import { appConfig } from '../../shared/config/AppConfig';
import { lazyPort } from './LazyPort';

export interface SessionDependencies {
  readonly port: SessionPort;
  readonly delete: DeleteSession;
  readonly disableStepup: DisableStepup;
  readonly startStepup: StartStepup;
  readonly completeStepup: CompleteStepup;
  readonly createIdentity: () => string;
}

export function createSessionDependencies(): Readonly<{ session: SessionDependencies }> {
  const port = lazyPort<SessionPort>(() => import('../../entity/session/infrastructure/SessionGateway').then(({ SessionGateway }) => new SessionGateway(appConfig.apiBaseUrl)));
  return Object.freeze({ session: Object.freeze({ port, delete: new DeleteSession(port), disableStepup: new DisableStepup(port), startStepup: new StartStepup(port), completeStepup: new CompleteStepup(port), createIdentity: createIdempotencyKey }) });
}
