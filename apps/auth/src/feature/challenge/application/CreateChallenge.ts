import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { ChallengeRequest } from '../model/Challenge';
import type { ChallengePort } from '../public/ChallengePort';

export class CreateChallenge {
  constructor(private readonly port: ChallengePort) {}
  execute(request: ChallengeRequest, target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal) {
    return this.port.create(request, target, returns, signal);
  }
}
