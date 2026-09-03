import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { Challenge, ChallengeRequest } from '../model/Challenge';

export interface ChallengePort {
  create(request: ChallengeRequest, target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal): Promise<Challenge>;
}
