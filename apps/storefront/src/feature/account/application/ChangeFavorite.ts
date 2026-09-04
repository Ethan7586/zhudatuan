import type { StorefrontSession } from '../../../entity/session';
import type { AccountPort } from '../public/AccountPort';

export class ChangeFavorite {
  constructor(private readonly gateway: Pick<AccountPort, 'changeFavorite'>) {}
  async execute(session: StorefrontSession, listingId: string, favorite: boolean): Promise<void> {
    await this.gateway.changeFavorite(session, listingId, favorite, `favorite:${listingId}:${favorite}:${crypto.randomUUID()}`);
  }
}
