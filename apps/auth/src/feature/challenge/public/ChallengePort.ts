import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { Challenge, ChallengeRequest } from '../model/Challenge';

export interface ChallengePort {
  create(request: ChallengeRequest, session: SessionRequest, signal?: AbortSignal): Promise<Challenge>;
}
