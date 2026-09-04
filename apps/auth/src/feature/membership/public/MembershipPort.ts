import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { MembershipSelection } from '../model/Membership';

export interface MembershipPort {
  read(session: SessionRequest, signal?: AbortSignal): Promise<MembershipSelection>;
  select(membership: string, session: SessionRequest, signal?: AbortSignal): Promise<Readonly<{ redirectUrl: string }>>;
}
