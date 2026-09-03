import type { AuthTarget } from '@shop/config/client';
import type { MembershipSelection } from '../model/Membership';

export interface MembershipPort {
  read(target: AuthTarget, signal?: AbortSignal): Promise<MembershipSelection>;
  select(membership: string, target: AuthTarget, signal?: AbortSignal): Promise<Readonly<{ redirectUrl: string }>>;
}
