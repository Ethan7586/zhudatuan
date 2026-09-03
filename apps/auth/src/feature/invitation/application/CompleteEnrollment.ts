import type { EnrollmentCompletion } from '../model/Enrollment';
import type { InvitationPort } from '../public/InvitationPort';

export class CompleteEnrollment {
  private readonly active = new Map<string, Promise<Awaited<ReturnType<InvitationPort['complete']>>>>();
  constructor(private readonly port: InvitationPort) {}
  execute(input: EnrollmentCompletion, signal?: AbortSignal) {
    const current = this.active.get(input.id);
    if (current) return current;
    const operation = this.port.complete(input, signal).finally(() => this.active.delete(input.id));
    this.active.set(input.id, operation);
    return operation;
  }
}
