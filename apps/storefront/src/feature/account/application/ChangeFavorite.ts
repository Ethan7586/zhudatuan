import type { StorefrontSession } from '../../../shared/api/Session';
import { AccountGateway } from '../infrastructure/AccountGateway';

export class ChangeFavorite {
  async execute(session: StorefrontSession, listingId: string, favorite: boolean): Promise<void> {
    await AccountGateway.changeFavorite(session, listingId, favorite, `favorite:${listingId}:${favorite}:${crypto.randomUUID()}`);
  }
}
