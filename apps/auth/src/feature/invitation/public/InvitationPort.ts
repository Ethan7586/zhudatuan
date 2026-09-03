import type { EnrollmentCompletion, EnrollmentState } from '../model/Enrollment';
import type { InvitationOutcome, InvitationResolution } from '../model/Invitation';

export interface InvitationPort {
  resolve(input: InvitationResolution): Promise<InvitationOutcome>;
  read(id: string, signal?: AbortSignal): Promise<EnrollmentState>;
  complete(input: EnrollmentCompletion, signal?: AbortSignal): Promise<InvitationOutcome>;
}
