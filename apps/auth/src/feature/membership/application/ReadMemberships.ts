import type { AuthTarget } from '@shop/config/client';
import type { MembershipPort } from '../public/MembershipPort';

export class ReadMemberships {
  constructor(private readonly port: MembershipPort) {}
  execute(target: AuthTarget, signal?: AbortSignal) { return this.port.read(target, signal); }
}
