import type { StorefrontSession } from '../../../entity/session';
import type { AccountPort } from '../public/AccountPort';

export class SwitchMembership {
  private key = `membership:${crypto.randomUUID()}`;
  constructor(private readonly gateway: Pick<AccountPort, 'switchMembership'>) {}

  async execute(session: StorefrontSession, membershipId: string): Promise<void> {
    await this.gateway.switchMembership(session, membershipId, this.key);
    this.key = `membership:${crypto.randomUUID()}`;
  }
}
