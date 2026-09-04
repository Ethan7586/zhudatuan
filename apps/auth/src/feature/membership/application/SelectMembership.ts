import type { AuthTarget } from '@shop/config/client';
import type { MembershipPort } from '../public/MembershipPort';

export class SelectMembership {
  constructor(private readonly port: MembershipPort) {}
  execute(membership: string, target: AuthTarget, signal?: AbortSignal) {
    return this.port.select(membership, target, signal);
  }
}
