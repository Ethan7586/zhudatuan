import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { MembershipPort } from '../public/MembershipPort';

export class ReadMemberships {
  constructor(private readonly port: MembershipPort) {}
  execute(session: SessionRequest, signal?: AbortSignal) {
    return this.port.read(session, signal);
  }
}
