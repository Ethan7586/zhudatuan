import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { EnrollmentPort } from '../public/EnrollmentPort';

export class ReadEnrollment {
  constructor(private readonly port: EnrollmentPort) {}

  execute(id: string, session: SessionRequest, signal?: AbortSignal) {
    return this.port.read(id, session, signal);
  }
}
