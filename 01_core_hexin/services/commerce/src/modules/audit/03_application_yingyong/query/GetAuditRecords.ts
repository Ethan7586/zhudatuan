import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import type { AuditPort } from '../../01_public_gongkai/AuditPort';

export function getAuditRecordsOperations(repository: AuditPort): OperationActions {
  return { 'audit.records.read': async (request, database: OperationDatabase) => {
    const access = requireAccess(request); const page = queryPage(request, 200);
    const rows = await repository.records(database, access.scope.id, { sort: page.sort, id: page.id }, page.fetch);
    const hasMore = rows.length > page.limit; const items = hasMore ? rows.slice(0,page.limit) : rows; const last = items.at(-1);
    const sort = last?.occurred_at; const id = last?.id;
    return { status:200, body:{ items, count:items.length, next:hasMore && typeof sort==='string' && typeof id==='string'
      ? encodeCursor({ sort, id }) : null } };
  } };
}
