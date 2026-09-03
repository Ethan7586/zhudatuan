import type { StorefrontSession } from '../../../entity/session';
import { AccountGateway } from '../infrastructure/AccountGateway';

export class SwitchMembership {
  private key = `membership:${crypto.randomUUID()}`;
  constructor(private readonly gateway: Pick<AccountGateway, 'switchMembership'>) {}

  async execute(session: StorefrontSession, membershipId: string): Promise<void> {
    await this.gateway.switchMembership(session, membershipId, this.key);
    this.key = `membership:${crypto.randomUUID()}`;
  }
}
