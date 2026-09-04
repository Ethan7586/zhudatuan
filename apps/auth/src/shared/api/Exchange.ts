import type { AuthTarget } from '@shop/config/client';
import { ClientError } from '@shop/sdk';
import type { AuthEnvironment } from '../../config/Environment';
import type { IdentitySdk } from './Client';
import { commandContext } from './Context';
import type { Authorization } from '../security/Authorization';
import { approvedDestination } from '../security/ReturnTarget';

export async function exchangeSession(
  sdk: IdentitySdk,
  environment: AuthEnvironment,
  input: Readonly<{ ticket: string; returnTarget: string }>,
  authorization: Authorization,
  target: AuthTarget,
  csrf: string,
  signal?: AbortSignal
): Promise<string> {
  const exchanged = await sdk.ticketsExchange(
    { body: { ticket: input.ticket, state: authorization.secret.state, nonce: authorization.secret.nonce, verifier: authorization.secret.verifier, returnTarget: input.returnTarget } },
    commandContext(environment, target, csrf, signal)
  );
  if (exchanged.returnTarget.target !== target) throw new ClientError('RETURN_TARGET_INVALID');
  return approvedDestination(exchanged.returnTarget.url, target, environment.returnOrigins);
}
