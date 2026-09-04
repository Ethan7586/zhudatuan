import type { ContractJsonObject } from '@shop/contract';
import { TransportError } from '@shop/sdk';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext } from '../../../shared/api/Context';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import { challengeState, type Challenge, type ChallengeRequest } from '../model/Challenge';
import type { ChallengePort } from '../public/ChallengePort';

export class ChallengeGateway implements ChallengePort {
  constructor(
    private readonly sdk: IdentitySdk,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort
  ) {}

  async create(request: ChallengeRequest, session: SessionRequest, signal?: AbortSignal): Promise<Challenge> {
    const state = await this.bootstrap.read(session, signal);
    const body = challengeBody(request);
    const result = await this.sdk.challengesCreate({ body }, commandContext(this.environment, session.target, state.csrf, signal));
    const challenge = challengeState({
      id: result.id,
      purpose: result.purpose,
      expiresAt: result.expires_at,
      retryAt: result.retry_at,
      attemptsRemaining: result.attempts_remaining,
    }, request.purpose);
    if (challenge === undefined) throw new TransportError('CONTRACT_INVALID', undefined, false);
    return challenge;
  }
}

function challengeBody(request: ChallengeRequest): ContractJsonObject {
  switch (request.purpose) {
    case 'login':
    case 'password_reset':
      return { purpose: request.purpose, destination: request.destination.trim() };
    case 'enrollment':
      return { purpose: request.purpose, enrollmentId: request.enrollmentId };
    case 'enrollment_campaign':
      return { purpose: request.purpose, enrollmentId: request.enrollmentId, destination: request.destination.trim() };
  }
}
