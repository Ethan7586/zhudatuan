import type { AuthClient, ChallengeRequest, EnrollmentCompletion } from '../../../entity/authentication/AuthClient';
import type { InvitationResolution } from '../model/Invitation';

export class InvitationGateway {
  constructor(private readonly identity: AuthClient) {}
  resolve(input: InvitationResolution) {
    return this.identity.invitation(input.code, input.target, input.returns, input.signal);
  }
  read(id: string, signal?: AbortSignal) {
    return this.identity.enrollment(id, signal);
  }
  challenge(request: ChallengeRequest, signal?: AbortSignal) {
    return this.identity.challenge(request, 'storefront', undefined, signal);
  }
  complete(input: EnrollmentCompletion, signal?: AbortSignal) {
    return this.identity.completeEnrollment(input, signal);
  }
}
