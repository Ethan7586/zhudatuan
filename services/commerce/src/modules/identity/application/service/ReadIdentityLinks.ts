import { type IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import type { IdentityLinker } from '../service/IdentityLinker';
export class ReadIdentityLinks {
  constructor(private readonly linker: IdentityLinker) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const access = requireAccess(request);
      const items = await this.linker.list(database, access.actor.id);
      return { status: 200, body: { items, count: items.length } };
    };
  }
}
