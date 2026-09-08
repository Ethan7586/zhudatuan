import { rowResult, requireAccess, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../foundation/interface/Validation';
import { CATALOG_LISTING_MANAGEMENT_STATUS_SQL } from './CatalogListingManagement';

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

export async function setListingBatchPublication(request: OperationRequest, database: OperationDatabase) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  if (body.action === 'publish_ready') {
    const result = await database.query(
      `with eligible as(
        select listing.id from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id
        where listing.scope_id=$1 and listing.status='draft'
          and (${CATALOG_LISTING_MANAGEMENT_STATUS_SQL})='pending_review'
        order by listing.id for update of listing
      )
      update catalog.listing listing set status='published',effective_at=clock_timestamp(),expires_at=null,
        version=listing.version+1,updated_at=clock_timestamp()
      from eligible where listing.id=eligible.id returning listing.id,listing.status,listing.version`,
      [access.scope.id],
    );
    return { status: 200, body: { action: 'publish_ready', items: result.rows, count: result.rowCount } };
  }
  if (body.action !== 'publish' && body.action !== 'unpublish') throw new Error('VALIDATION_FAILED:action');
  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) throw new Error('VALIDATION_FAILED:ids');
  const state = body.action === 'publish' ? 'published' : 'unpublished';
  const result = await database.query(
    `update catalog.listing set status=$3,effective_at=case when $3='published' then clock_timestamp() else effective_at end,
    expires_at=case when $3='unpublished' then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp()
    where scope_id=$1 and id=any($2::text[]) returning id,status,version`,
    [access.scope.id, body.ids, state],
  );
  return { status: 200, body: { action: body.action, items: result.rows, count: result.rowCount } };
}
