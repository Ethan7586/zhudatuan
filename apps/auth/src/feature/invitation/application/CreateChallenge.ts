import type { ChallengeRequest } from '../../../entity/authentication/AuthClient';
import type { InvitationGateway } from '../infrastructure/InvitationGateway';

export class CreateChallenge {
  constructor(private readonly gateway: InvitationGateway) {}
  execute(request: ChallengeRequest, signal?: AbortSignal) { return this.gateway.challenge(request, signal); }
}
