import type { StorefrontSession } from '../../../shared/api/Session';
import { AccountGateway } from '../infrastructure/AccountGateway';

export class SwitchMembership {
  private key = `membership:${crypto.randomUUID()}`;

  async execute(session: StorefrontSession, membershipId: string): Promise<void> {
    await AccountGateway.switchMembership(session, membershipId, this.key);
    this.key = `membership:${crypto.randomUUID()}`;
  }
}
