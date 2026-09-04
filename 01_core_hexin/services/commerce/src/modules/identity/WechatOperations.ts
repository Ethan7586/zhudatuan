import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { AuditSink } from '../../foundation/application/AuditSink';
import { appendOperationAudit, operationRequestHash, reject, requireAccess } from '../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../foundation/interface/Validation';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationHandler';
import type { KmsClient } from '../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { WechatIdentity } from './application/port/WechatIdentity';
import { beginIdempotency, bindWechat, completeIdempotency, identityTransaction, publishIdentityEvent, tokenHash } from './IdentityPersistence';
import type { WechatScene } from '@shop/config/server';
import { AuthTransaction } from './domain/model/AuthTransaction';
import type { PgAuthTicket } from './infrastructure/PgAuthTicket';
import { authTarget, sessionCookies } from './IdentitySecurity';

export class WechatOperations implements OperationUsecase {
  constructor(private readonly core: OperationUsecase, private readonly pool: DatabasePool, private readonly gateway: WechatIdentity,
    private readonly kms: KmsClient, private readonly audit: AuditSink, private readonly identityKey: string, private readonly sessionKey: string,
    private readonly tickets: PgAuthTicket) {}

  invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'identity.wechat.session') return this.session(request);
    if (request.type === 'identity.wechat.bind') return this.bind(request);
    return this.core.invoke(request);
  }

  private async session(request: OperationRequest): Promise<OperationResult> {
    const body = bodyRecord(request);
    const sceneValue = textField(body, 'scene', 16);
    if (sceneValue !== 'miniapp' && sceneValue !== 'jsapi') throw new Error('WECHAT_SCENE_INVALID');
    const scene: WechatScene = sceneValue;
    const action = textField(body, 'action', 16);
    if (action === 'authorize') {
      if (scene !== 'jsapi') throw new Error('WECHAT_AUTHORIZATION_SCENE_INVALID');
      const authorization = AuthTransaction.start(body.authorization);
      return { status: 200, body: { authorizationUrl: this.gateway.authorize('jsapi', authorization.state) } };
    }
    if (action !== 'exchange') throw new Error('WECHAT_SESSION_ACTION_INVALID');
    const authorization = scene === 'jsapi' ? AuthTransaction.start(body.authorization) : null;
    const exchanged = await this.gateway.exchange(scene, textField(body, 'code'));
    const applicationHash = this.gateway.application(scene).applicationHash;
    const stableHash = createHmac('sha256', this.identityKey).update(`${applicationHash}:${exchanged.subject}`).digest('hex');
    const identity = `wechat:${stableHash}`;
    const envelope = await this.kms.encrypt('identity/wechat', exchanged.subject, { identity });
    const unionHash = exchanged.union === undefined ? null
      : (await this.kms.encrypt('identity/wechat', exchanged.union, { identity, value: 'union' })).fingerprint;
    return identityTransaction(this.pool, request, async (database) => {
      const repeated = await beginIdempotency(database, request, 'identity');
      if (repeated) return repeated;
      await database.query(`insert into identity.federatedidentity(id,principal_id,membership_id,provider,application_hash,subject_hash,union_hash,
        subject_ciphertext,subject_key_version,status,created_at,updated_at)
        values($1,null,null,'wechat',$2,$3,$4,$5,$6,'unbound',clock_timestamp(),clock_timestamp())
        on conflict(provider,application_hash,subject_hash) do update set union_hash=coalesce(excluded.union_hash,identity.federatedidentity.union_hash),
          subject_ciphertext=excluded.subject_ciphertext,subject_key_version=excluded.subject_key_version,updated_at=clock_timestamp()`,
      [identity, applicationHash, envelope.fingerprint, unionHash, envelope.ciphertext, envelope.keyVersion]);
      if (unionHash) await database.query(`update identity.federatedidentity target set principal_id=source.principal_id,membership_id=source.membership_id,
        status='active',bound_at=clock_timestamp(),updated_at=clock_timestamp()
        from (select principal_id,membership_id from identity.federatedidentity where provider='wechat' and union_hash=$3 and status='active'
          and principal_id is not null and membership_id is not null order by id limit 1) source
        where target.provider='wechat' and target.application_hash=$1 and target.subject_hash=$2 and target.status='unbound'`,
      [applicationHash, envelope.fingerprint, unionHash]);
      const found = await database.query<{ id: string; principal_id: string | null; membership_id: string | null; status: string }>(`select id,principal_id,membership_id,status
        from identity.federatedidentity where provider='wechat' and application_hash=$1 and subject_hash=$2 for update`, [applicationHash, envelope.fingerprint]);
      const current = found.rows[0];
      if (!current || current.status === 'revoked') reject(403, 'WECHAT_IDENTITY_REVOKED');
      const result = current.status === 'active' && current.principal_id && current.membership_id
        ? await this.createSession(database, request, body, current.principal_id, current.membership_id, scene, authorization)
        : await this.createGrant(database, current.id);
      const hash = operationRequestHash(request);
      await appendOperationAudit(this.audit, database, request, 'identity', result, current.principal_id ?? 'public:identity.wechat.session',
        current.membership_id ?? 'identity', hash);
      await completeIdempotency(database, request, 'identity', result);
      return result;
    });
  }

  private async createSession(database: import('../../foundation/application/ModuleOperations').OperationDatabase, request: OperationRequest,
    body: Readonly<Record<string, unknown>>, principal: string, membershipid: string, scene: WechatScene,
    authorization: AuthTransaction | null): Promise<OperationResult> {
    const membership = await database.query<{ access_version: number; client: string; credential_version: number }>(`select membership.access_version,membership.client,principal.credential_version
      from access.membership membership join member.profile profile on profile.id=membership.member_id join identity.principal principal on principal.id=profile.principal_id
      where membership.id=$1 and principal.id=$2 and membership.status='active' and principal.status='active' for update`, [membershipid, principal]);
    const active = membership.rows[0];
    if (!active) reject(403, 'WECHAT_MEMBERSHIP_INACTIVE');
    const token = randomBytes(48).toString('base64url');
    const session = `session:${randomUUID()}`;
    await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
      user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,clock_timestamp()+interval '12 hours',clock_timestamp(),clock_timestamp())`,
    [session, principal, membershipid, tokenHash(token), active.credential_version, active.access_version, active.client,
      createHmac('sha256', this.sessionKey).update(request.input.headers['x-peer-address'] ?? 'unknown').digest('hex'),
      String(request.input.headers['user-agent'] ?? 'unknown').slice(0, 512), String(request.input.headers['x-device-id'] ?? 'wechat').slice(0, 128)]);
    await publishIdentityEvent(database, 'identity.session.created', session, membershipid, request.input.idempotency!, { principal, membership: membershipid });
    if (scene === 'jsapi') {
      if (!authorization) throw new Error('AUTH_TRANSACTION_REQUIRED');
      const csrf = randomBytes(32).toString('base64url');
      const callback = await this.tickets.issue(database, session, authTarget(active.client), authorization);
      return { status: 201, body: { session, csrf, expiresIn: 43_200, membership: membershipid, callback },
        headers: sessionCookies(token, csrf, 43_200) };
    }
    return { status: 201, body: { token, session, expiresIn: 43_200, membership: membershipid } };
  }

  private async createGrant(database: import('../../foundation/application/ModuleOperations').OperationDatabase, identity: string): Promise<OperationResult> {
    await database.query('update identity.wechatgrant set consumed_at=clock_timestamp() where identity_id=$1 and consumed_at is null', [identity]);
    const token = randomBytes(48).toString('base64url');
    await database.query(`insert into identity.wechatgrant(id,identity_id,token_hash,expires_at,created_at)
      values($1,$2,$3,clock_timestamp()+interval '10 minutes',clock_timestamp())`, [`wechatgrant:${randomUUID()}`, identity, tokenHash(token)]);
    return { status: 202, body: { bindingToken: token, expiresIn: 600, state: 'registration_required' } };
  }

  private async bind(request: OperationRequest): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    return identityTransaction(this.pool, request, async (database) => {
      const repeated = await beginIdempotency(database, request, access.scope.id);
      if (repeated) return repeated;
      const identity = await bindWechat(database, tokenHash(textField(body, 'bindingToken', 1024)), access.actor.id, access.membership.id);
      const result = { status: 200, body: { identity, status: 'active' } } satisfies OperationResult;
      await appendOperationAudit(this.audit, database, request, 'identity', result, access.actor.id, access.scope.id, operationRequestHash(request));
      await completeIdempotency(database, request, access.scope.id, result);
      return result;
    });
  }
}
