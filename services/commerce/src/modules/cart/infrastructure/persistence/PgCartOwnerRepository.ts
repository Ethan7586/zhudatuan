import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { CartExperiencePort, ExperienceReadPort } from '../../../experience/public';
import type { CartOwnerRepository } from '../../application/port/CartOwnerRepository';

export class PgCartOwnerRepository implements CartOwnerRepository {
  constructor(
    private readonly members: MemberAccessPort,
    private readonly experience: CartExperiencePort,
    private readonly entries: ExperienceReadPort
  ) {}

  async member(context: ReadTransactionContext, membership: string) {
    const profile = await this.members.profile(context, membership);
    const application = await this.experience.active(context, profile.organization);
    if (!application) throw new Error('ACTIVE_MALL_APPLICATION_MISSING');
    return Object.freeze({ kind: 'member' as const, member: profile.member, mall: profile.organization, application });
  }

  async anonymous(context: ReadTransactionContext, handle: string) {
    const entry = await this.entries.resolveEntry(context, handle);
    return Object.freeze({ mall: entry.mall, application: entry.application });
  }
}
