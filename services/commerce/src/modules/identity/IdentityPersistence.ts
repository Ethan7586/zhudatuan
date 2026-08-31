import { createHash, randomUUID } from 'node:crypto';
import { reject, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../foundation/application/OperationHandler';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { applyApiDatabaseContext } from '../../foundation/infrastructure/DatabaseContext';

export async function bindWechat(database: OperationDatabase, hash: string, principal: string, membership: string): Promise<string> {
<<<<<<< HEAD
<<<<<<< HEAD
  const grant = await database.query<{ identity_id: string; application_hash: string }>(`select bindinggrant.identity_id,identity.application_hash from identity.wechatgrant bindinggrant
    join identity.federatedidentity identity on identity.id=bindinggrant.identity_id
    where bindinggrant.token_hash=$1 and bindinggrant.consumed_at is null and bindinggrant.expires_at>clock_timestamp() and identity.status='unbound' for update of bindinggrant,identity`, [hash]);
=======
  const grant = await database.query<{ identity_id: string; application_hash: string }>(`select grant.identity_id,identity.application_hash from identity.wechatgrant grant
    join identity.federatedidentity identity on identity.id=grant.identity_id
    where grant.token_hash=$1 and grant.consumed_at is null and grant.expires_at>clock_timestamp() and identity.status='unbound' for update of grant,identity`, [hash]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const grant = await database.query<{ identity_id: string; application_hash: string }>(`select bindinggrant.identity_id,identity.application_hash from identity.wechatgrant bindinggrant
    join identity.federatedidentity identity on identity.id=bindinggrant.identity_id
    where bindinggrant.token_hash=$1 and bindinggrant.consumed_at is null and bindinggrant.expires_at>clock_timestamp() and identity.status='unbound' for update of bindinggrant,identity`, [hash]);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const found = grant.rows[0];
  if (!found) reject(400, 'WECHAT_BINDING_TOKEN_INVALID');
  const conflicting = await database.query(`select 1 from identity.federatedidentity where provider='wechat' and application_hash=$1 and principal_id=$2 and status='active' and id<>$3`,
    [found.application_hash, principal, found.identity_id]);
  if (conflicting.rows[0]) reject(409, 'WECHAT_IDENTITY_ALREADY_BOUND');
  const updated = await database.query<{ id: string }>(`update identity.federatedidentity set principal_id=$2,membership_id=$3,status='active',bound_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=$1 and status='unbound' returning id`, [found.identity_id, principal, membership]);
  if (!updated.rows[0]) reject(409, 'WECHAT_IDENTITY_BIND_CONFLICT');
  await database.query('update identity.wechatgrant set consumed_at=clock_timestamp() where identity_id=$1 and consumed_at is null', [found.identity_id]);
  return found.identity_id;
}

export async function identityTransaction<T>(pool: DatabasePool, request: OperationRequest, action: (database: OperationDatabase) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const access = request.access;
    await applyApiDatabaseContext(client, { tenant: access?.scope.tenant ?? '', membership: access?.membership.id ?? '',
      scope: access?.scope.id ?? 'public:identity', actor: access?.actor.id ?? 'public', trace: access?.trace ?? `public:${request.type}` });
    const result = await action(client);
    await client.query('commit');
    return result;
  } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
}

export async function beginIdempotency(database: OperationDatabase, request: OperationRequest, scope: string): Promise<OperationResult | null> {
  const key = request.input.idempotency;
  if (!key) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  const hash = requestDigest(request);
  const actor = request.access?.actor.id ?? `public:${hash.slice(0, 24)}`;
  await database.query(`insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at)
    values($1,$2,$3,$4,'started',clock_timestamp()+interval '24 hours') on conflict do nothing`, [scope, actor, key, hash]);
  const record = await database.query<{ request_hash: string; state: string; response: OperationResult | null }>(
    'select request_hash,state,response from runtime.idempotency where scope=$1 and actor_id=$2 and key=$3 for update', [scope, actor, key]);
  const found = record.rows[0];
  if (!found || found.request_hash !== hash) throw new Error('IDEMPOTENCY_KEY_REUSED');
  return found.state === 'completed' ? found.response : null;
}

export async function completeIdempotency(database: OperationDatabase, request: OperationRequest, scope: string, result: OperationResult): Promise<void> {
  const hash = requestDigest(request);
  const actor = request.access?.actor.id ?? `public:${hash.slice(0, 24)}`;
  await database.query(`update runtime.idempotency set state='completed',response=$4::jsonb where scope=$1 and actor_id=$2 and key=$3`,
    [scope, actor, request.input.idempotency!, JSON.stringify(result)]);
}

export async function publishIdentityEvent(database: OperationDatabase, type: string, aggregate: string, scope: string, trace: string, payload: unknown): Promise<void> {
  await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values($1,$2,1,'identity',$3,$4,$5::jsonb,$6,clock_timestamp(),clock_timestamp())`, [`event:${randomUUID()}`, type, aggregate, scope, JSON.stringify(payload), trace]);
}

export function tokenHash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function requestDigest(request: OperationRequest): string {
  return createHash('sha256').update(JSON.stringify({ type: request.type, body: request.input.body })).digest('hex');
}
