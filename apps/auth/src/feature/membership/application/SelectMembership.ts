import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { MembershipPort } from '../public/MembershipPort';

export class SelectMembership {
  constructor(private readonly port: MembershipPort) {}
  execute(membership: string, session: SessionRequest, signal?: AbortSignal) {
    return this.port.select(membership, session, signal);
  }
}
