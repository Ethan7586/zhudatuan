import type { StorefrontSession } from '../../../shared/api/Session';
import type { AddressDraft } from '../model/Address';
import { AccountGateway } from '../infrastructure/AccountGateway';

export class ChangeAddress {
  save(session: StorefrontSession, addressId: string, draft: AddressDraft, expectedVersion: number): Promise<unknown> {
    return AccountGateway.changeAddress(session, addressId, draft, expectedVersion, crypto.randomUUID());
  }

  remove(session: StorefrontSession, addressId: string, expectedVersion: number): Promise<unknown> {
    return AccountGateway.changeAddress(session, addressId, null, expectedVersion, crypto.randomUUID());
  }
}
