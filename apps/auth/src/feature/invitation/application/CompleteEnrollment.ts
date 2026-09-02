import type { EnrollmentCompletion } from '../../../entity/authentication/AuthClient';
import type { InvitationGateway } from '../infrastructure/InvitationGateway';

export class CompleteEnrollment {
  constructor(private readonly gateway: InvitationGateway) {}
  execute(input: EnrollmentCompletion, signal?: AbortSignal) { return this.gateway.complete(input, signal); }
}
