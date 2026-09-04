import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { EnrollmentCompletion } from '../model/Enrollment';
import type { EnrollmentPort } from '../public/EnrollmentPort';

export class CompleteEnrollment {
  private readonly active = new Map<string, Promise<Awaited<ReturnType<EnrollmentPort['complete']>>>>();

  constructor(private readonly port: EnrollmentPort) {}

  execute(input: EnrollmentCompletion, session: SessionRequest, signal?: AbortSignal) {
    const current = this.active.get(input.id);
    if (current) return current;
    const operation = this.port.complete(input, session, signal).finally(() => this.active.delete(input.id));
    this.active.set(input.id, operation);
    return operation;
  }
}
