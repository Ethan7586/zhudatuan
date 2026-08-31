import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { IdentityLinker } from '../service/IdentityLinker';
export class RevokeIdentityLink {
  constructor(private readonly linker: IdentityLinker) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const link = request.input.path.linkid;
      if (!link || link.length > 255) throw new DomainError('VALIDATION_FAILED');
      await this.linker.revoke(database, access.actor.id, link);
      return { status: 204 };
    };
  }
}
