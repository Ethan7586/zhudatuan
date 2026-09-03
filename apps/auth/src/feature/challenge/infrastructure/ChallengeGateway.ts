import type { AuthTarget } from '@shop/config/client';
import type { ContractJsonObject } from '@shop/contract';
import { TransportError } from '@shop/sdk';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext } from '../../../shared/api/Context';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { Challenge, ChallengeRequest } from '../model/Challenge';
import type { ChallengePort } from '../public/ChallengePort';

export class ChallengeGateway implements ChallengePort {
  constructor(private readonly sdk: IdentitySdk, private readonly environment: AuthEnvironment, private readonly bootstrap: BootstrapPort) {}

  async create(request: ChallengeRequest, target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal): Promise<Challenge> {
    const state = await this.bootstrap.read(target, returns, signal);
    const body = challengeBody(request);
    const result = await this.sdk.challengesCreate({ body }, commandContext(this.environment, target, state.csrf, signal));
    const expiresAt = Date.parse(result.expires_at);
    const retryAt = Date.parse(result.retry_at);
    const now = Date.now();
    if (!Number.isFinite(expiresAt) || !Number.isFinite(retryAt) || expiresAt <= retryAt) throw new TransportError('CONTRACT_INVALID', undefined, false);
    return Object.freeze({ id: result.id, expiresAt: result.expires_at, retryAt: result.retry_at, validSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)), resendSeconds: Math.max(0, Math.ceil((retryAt - now) / 1000)) });
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
