import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { LoginOutcome } from '../../login';
import type { EnrollmentCompletion, EnrollmentState } from '../model/Enrollment';

export interface EnrollmentPort {
  read(id: string, session: SessionRequest, signal?: AbortSignal): Promise<EnrollmentState>;
  complete(input: EnrollmentCompletion, session: SessionRequest, signal?: AbortSignal): Promise<LoginOutcome>;
}
