import type { StorefrontSession } from '../../../entity/session';
import type { AddressDraft } from '../model/Address';
import type { AccountPort } from '../public/AccountPort';

export class ChangeAddress {
  constructor(private readonly gateway: Pick<AccountPort, 'changeAddress'>) {}
  save(session: StorefrontSession, addressId: string, draft: AddressDraft, expectedVersion: number): Promise<unknown> {
    return this.gateway.changeAddress(session, addressId, draft, expectedVersion, crypto.randomUUID());
  }

  remove(session: StorefrontSession, addressId: string, expectedVersion: number): Promise<unknown> {
    return this.gateway.changeAddress(session, addressId, null, expectedVersion, crypto.randomUUID());
  }
}
