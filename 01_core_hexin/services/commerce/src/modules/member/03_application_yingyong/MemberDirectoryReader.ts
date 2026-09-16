import { buildMemberDirectoryQuery } from '../04_adapters_shixian/persistence/MemberDirectoryQuery';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

/** Existing SQL read path; the caller supplies the node's database and scope. */
export function readMemberDirectory(
  database: OperationDatabase,
  scopeId: string,
  search: string,
  cursor: string | null,
  fetch: number,
  identityMembership: string | null,
) {
  const { text, values } = buildMemberDirectoryQuery(scopeId, search, cursor, fetch, identityMembership);
  return database.query(text, values);
}
