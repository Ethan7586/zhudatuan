import type { StorefrontSession } from '../../../entity/session';
import { AccountGateway } from '../infrastructure/AccountGateway';

export class ChangeFavorite {
  constructor(private readonly gateway: Pick<AccountGateway, 'changeFavorite'>) {}
  async execute(session: StorefrontSession, listingId: string, favorite: boolean): Promise<void> {
    await this.gateway.changeFavorite(session, listingId, favorite, `favorite:${listingId}:${favorite}:${crypto.randomUUID()}`);
  }
}
