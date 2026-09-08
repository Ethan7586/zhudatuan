import { createHash, randomUUID } from 'node:crypto';
import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export type PreparedWechatBinding = Readonly<{ identity: string }>;

export async function prepareWechatBinding(database: OperationDatabase, hash: string, _principal: string,
  realm: string, account: string): Promise<PreparedWechatBinding> {
  const grant = await database.query<{ identity_id: string; application_hash: string }>(`select bindinggrant.identity_id,identity.application_hash from identity.wechatgrant bindinggrant
    join identity.federatedidentity identity on identity.id=bindinggrant.identity_id
    where bindinggrant.token_hash=$1 and bindinggrant.consumed_at is null and bindinggrant.expires_at>clock_timestamp()
      and identity.realm_id=$2 and identity.status in('unbound','active') for update of bindinggrant,identity`, [hash, realm]);
  const found = grant.rows[0];
  if (!found) reject(400, 'WECHAT_BINDING_TOKEN_INVALID');
  const conflicting = await database.query(`select 1 from identity.federatedidentity where realm_id=$1 and provider='wechat'
    and application_hash=$2 and account_id=$3 and status='active' and id<>$4`,
    [realm, found.application_hash, account, found.identity_id]);
  if (conflicting.rows[0]) reject(409, 'WECHAT_IDENTITY_ALREADY_BOUND');
  return { identity: found.identity_id };
}

export async function completeWechatBinding(database: OperationDatabase, binding: PreparedWechatBinding,
  principal: string, membership: string, realm: string, account: string): Promise<string> {
  const updated = await database.query<{ id: string }>(`update identity.federatedidentity identity
    set principal_id=$2,membership_id=$3,realm_id=$4,account_id=$5,status='active',bound_at=clock_timestamp(),updated_at=clock_timestamp()
    where identity.id=$1 and identity.realm_id=$4 and identity.status in('unbound','active')
      and exists(select 1 from access.membership membership where membership.id=$3
        and membership.account_id=$5 and membership.realm_id=$4 and membership.status='active') returning identity.id`,
  [binding.identity, principal, membership, realm, account]);
  if (!updated.rows[0]) throw new Error('WECHAT_IDENTITY_BIND_CONFLICT');
  await database.query('update identity.wechatgrant set consumed_at=clock_timestamp() where identity_id=$1 and consumed_at is null', [binding.identity]);
  return binding.identity;
}

export async function bindWechat(database: OperationDatabase, hash: string, principal: string, membership: string,
  realm: string, account: string): Promise<string> {
  const binding = await prepareWechatBinding(database, hash, principal, realm, account);
  return completeWechatBinding(database, binding, principal, membership, realm, account);
}

export async function atomicIdentityMutation<T>(database: OperationDatabase, action: () => Promise<T>): Promise<T> {
  await database.query('savepoint identity_business_mutation');
  let result: T;
  try {
    result = await action();
  } catch (cause) {
    await database.query('rollback to savepoint identity_business_mutation');
    await database.query('release savepoint identity_business_mutation');
    throw cause;
  }
  await database.query('release savepoint identity_business_mutation');
  return result;
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
