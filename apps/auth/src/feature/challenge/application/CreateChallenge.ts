import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { ChallengeRequest } from '../model/Challenge';
import type { ChallengePort } from '../public/ChallengePort';

export class CreateChallenge {
  constructor(private readonly port: ChallengePort) {}
  execute(request: ChallengeRequest, session: SessionRequest, signal?: AbortSignal) {
    return this.port.create(request, session, signal);
  }
}
