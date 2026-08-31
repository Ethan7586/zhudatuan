import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import { requireAccess, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { MemberAccessPort } from '../../../access/public';
import type { CartExperiencePort } from '../../../experience/public';
import type { CartRepository } from '../port/CartRepository';

export class ReadCurrentCart {
  constructor(
    private readonly members: MemberAccessPort,
    private readonly experience: CartExperiencePort,
    private readonly carts: CartRepository
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const owner = await this.members.profile(database, access.membership.id);
    const application = await this.experience.active(database, owner.organization);
    if (!application) return { status: 200, body: { items: [], version: 0 } };
    return { status: 200, body: (await this.carts.currentView(database, owner.member, owner.organization, application)) ?? { items: [], version: 0 } };
  }
}
