import { requireAccess, type OperationAction } from '../../../../foundation/application/ModuleOperations';
import type { IdentityLinker } from '../service/IdentityLinker';
export class ReadIdentityLinks {
  constructor(private readonly linker: IdentityLinker) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const items = await this.linker.list(database, access.actor.id);
      return { status: 200, body: { items, count: items.length } };
    };
  }
}
