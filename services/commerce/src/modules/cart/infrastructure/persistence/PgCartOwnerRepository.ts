import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { CartExperiencePort } from '../../../experience/public';
import type { CartOwnerRepository } from '../../application/port/CartOwnerRepository';

export class PgCartOwnerRepository implements CartOwnerRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly members: MemberAccessPort,
    private readonly experience: CartExperiencePort
  ) {}
  async resolve(context: ReadTransactionContext, membership: string) {
    const database = this.transactions.database(context);
    const owner = await this.members.profile(context, membership);
    return Object.freeze({ member: owner.member, mall: owner.organization, application: await this.experience.active(context, owner.organization) });
  }
}
