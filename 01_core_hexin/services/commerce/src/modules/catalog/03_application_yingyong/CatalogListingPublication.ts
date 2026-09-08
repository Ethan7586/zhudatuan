import { randomUUID } from 'node:crypto';
import { rowResult, requireAccess, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../foundation/interface/Validation';

const SELECTED_STOREFRONT_POOL_CTE = `selected_pool as(
  select binding.pool_id from experience.binding binding
  join experience.application application on application.id=binding.application_id
    and application.status='active' and binding.domain=application.public_slug
  where binding.mall_id=$2 and exists(
    select 1 from experience.release release where release.application_id=application.id
      and release.state='active' and release.effective_at<=clock_timestamp()
      and (release.retired_at is null or release.retired_at>clock_timestamp())
  ) order by application.updated_at desc,application.id,binding.pool_id limit 1
)`;

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
    `with ${SELECTED_STOREFRONT_POOL_CTE}
    update catalog.listing set pool_id=case when $4='published'
        then coalesce(pool_id,(select pool_id from selected_pool)) else pool_id end,status=$4,
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
    const id = `catalogpublication:${randomUUID()}`;
    await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'catalogpublication','catalog',$2,
        jsonb_build_object('action','publish_ready','total',0,'processed',0,'published',0,'phase','queued'),
        'queued',90,clock_timestamp(),clock_timestamp(),clock_timestamp())`, [id, access.scope.id]);
    return { status: 202, body: { id, action: 'publish_ready', state: 'queued', items: [], count: 0 } };
  }
  if (body.action !== 'publish' && body.action !== 'unpublish') throw new Error('VALIDATION_FAILED:action');
  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) throw new Error('VALIDATION_FAILED:ids');
  const state = body.action === 'publish' ? 'published' : 'unpublished';
  const result = await database.query(
    `with ${SELECTED_STOREFRONT_POOL_CTE}
    update catalog.listing set pool_id=case when $3='published'
      then coalesce(pool_id,(select pool_id from selected_pool)) else pool_id end,
    status=$3,effective_at=case when $3='published' then clock_timestamp() else effective_at end,
    expires_at=case when $3='unpublished' then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp()
    where scope_id=$2 and id=any($1::text[]) returning id,status,version`,
    [body.ids, access.scope.id, state],
  );
  return { status: 200, body: { action: body.action, items: result.rows, count: result.rowCount } };
}
