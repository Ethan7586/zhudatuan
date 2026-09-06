import { rowResult, requireAccess, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';

export async function setListingPublication(
  request: OperationRequest,
  database: OperationDatabase,
  state: 'published' | 'unpublished',
) {
  const access = requireAccess(request);
  const expectedVersion = request.input.expectedVersion;
  if (expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  const listing = request.input.path.listingid!;
  const result = await database.query(
    `update catalog.listing set status=$4,
      effective_at=case when $4='published' then clock_timestamp() else effective_at end,
      expires_at=case when $4='unpublished' then clock_timestamp() else null end,
      version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and version=$3 returning *`,
    [listing, access.scope.id, expectedVersion, state],
  );
  if (result.rows[0]) return rowResult(result);
  const exists = await database.query('select version from catalog.listing where id=$1 and scope_id=$2', [listing, access.scope.id]);
  if (exists.rows[0]) throw new Error('VERSION_CONFLICT');
  throw new Error('RESOURCE_NOT_FOUND');
}
