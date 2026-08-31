import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import type { RiskRepository } from '../port/RiskCheck';

export function getRiskCenterOperations(factory: (database: OperationDatabase) => RiskRepository): OperationActions {
  return {
    'risk.center.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 200);
      const rows = await factory(database).center(access.scope.id, page.id, page.fetch);
      const more = rows.length > page.limit;
      const items = more ? rows.slice(0, page.limit) : rows;
      const last = items.at(-1);
      const id = typeof last?.id === 'string' ? last.id : null;
      return { status: 200, body: { items, count: items.length, ...(more && id ? { nextCursor: encodeCursor({ sort: id, id }) } : {}) } };
    },
  };
}
