import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import { appendOperationAudit, operationRequestHash, reject, requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../../../foundation/application/OperationHandler';
import { markEnforcedWriteResult } from '../../../../foundation/application/ExecutionKernel';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { WechatIdentity } from '../../01_public_gongkai/ports_jiekou/WechatIdentity';
import { beginIdempotency, bindWechat, completeIdempotency, identityTransaction, publishIdentityEvent, tokenHash } from '../../04_adapters_shixian/persistence_cunchu/IdentityPersistence';
import type { WechatScene } from '@shop/config/server';
import type { IdentityRealmContext } from '@shop/config/server';
import { AuthTransaction } from '../../02_domain_yewu/models_moxing/AuthTransaction';
import type { PgAuthTicket } from '../../04_adapters_shixian/persistence_cunchu/PgAuthTicket';
import { authMembershipTarget, authTarget, sessionCookies } from './IdentitySecurity';
import { currentRealmAccount, resolveRealmContext, resolveRealmNode, type RealmNodeContext } from '../../03_application_yingyong/services_fuwu/RealmAccount';

export class WechatOperations implements OperationUsecase {
  constructor(private readonly core: OperationUsecase, private readonly pool: DatabasePool, private readonly gateway: WechatIdentity,
    private readonly kms: KmsClient, private readonly audit: AuditSink, private readonly identityKey: string, private readonly sessionKey: string,
    private readonly tickets: PgAuthTicket) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'identity.wechat.session') return markEnforcedWriteResult(await this.session(request));
    if (request.type === 'identity.wechat.bind') return markEnforcedWriteResult(await this.bind(request));
    return this.core.invoke(request);
  }

  private async resolveRealm(request: OperationRequest, returnTarget: ReturnType<typeof authTarget> | null,
    application: string | null): Promise<RealmNodeContext | IdentityRealmContext> {
    const database = await this.pool.connect();
    try {
      return returnTarget === null
        ? await resolveRealmNode(database, request.input.headers.host)
        : await resolveRealmContext(database, request.input.headers.host, returnTarget, application ?? undefined);
    } finally {
      database.release();
    }
  }

  private async session(request: OperationRequest): Promise<OperationResult> {
    const body = bodyRecord(request);
    const sceneValue = textField(body, 'scene', 16);
    if (sceneValue !== 'miniapp' && sceneValue !== 'jsapi') throw new Error('WECHAT_SCENE_INVALID');
    const scene: WechatScene = sceneValue;
    const action = textField(body, 'action', 16);
    if (action === 'jssdk_config') {
      if (scene !== 'jsapi') throw new Error('WECHAT_AUTHORIZATION_SCENE_INVALID');
      return { status: 200, body: await this.gateway.jsSdkConfiguration(textField(body, 'url', 2048)) };
    }
    if (action === 'authorize') {
      if (scene !== 'jsapi') throw new Error('WECHAT_AUTHORIZATION_SCENE_INVALID');
      const authorization = AuthTransaction.start(body.authorization);
      return { status: 200, body: { authorizationUrl: this.gateway.authorize('jsapi', authorization.state) } };
    }
    if (action !== 'exchange') throw new Error('WECHAT_SESSION_ACTION_INVALID');
    const authorization = scene === 'jsapi' ? AuthTransaction.start(body.authorization) : null;
    const returnTarget = scene === 'jsapi' ? authTarget(textField(body, 'target')) : null;
    const application = scene === 'jsapi' ? textField(body, 'application') : null;
    const realm = await this.resolveRealm(request, returnTarget, application);
    if (returnTarget !== null && authMembershipTarget(returnTarget) !== 'storefront') {
      throw new Error('AUTH_RETURN_TARGET_INVALID');
    }
    const exchanged = await this.gateway.exchange(scene, textField(body, 'code'));
    const applicationHash = this.gateway.application(scene).applicationHash;
    const stableHash = createHmac('sha256', this.identityKey).update(`${realm.realmId}:${applicationHash}:${exchanged.subject}`).digest('hex');
    const identity = `wechat:${stableHash}`;
    const envelope = await this.kms.encrypt('identity/wechat', exchanged.subject, { identity });
    const unionHash = exchanged.union === undefined ? null
      : (await this.kms.encrypt('identity/wechat', exchanged.union, { identity, value: 'union' })).fingerprint;
    return identityTransaction(this.pool, request, async (database) => {
      const repeated = await beginIdempotency(database, request, 'identity');
      if (repeated) return repeated;
      await database.query(`insert into identity.federatedidentity(id,principal_id,membership_id,provider,application_hash,subject_hash,union_hash,
        subject_ciphertext,subject_key_version,status,created_at,updated_at,realm_id,account_id)
        values($1,null,null,'wechat',$2,$3,$4,$5,$6,'unbound',clock_timestamp(),clock_timestamp(),$7,null)
        on conflict(realm_id,provider,application_hash,subject_hash) where realm_id is not null do update
          set union_hash=coalesce(excluded.union_hash,identity.federatedidentity.union_hash),
          subject_ciphertext=excluded.subject_ciphertext,subject_key_version=excluded.subject_key_version,updated_at=clock_timestamp()`,
      [identity, applicationHash, envelope.fingerprint, unionHash, envelope.ciphertext, envelope.keyVersion, realm.realmId]);
      if (unionHash) await database.query(`update identity.federatedidentity target set principal_id=source.principal_id,membership_id=source.membership_id,
        account_id=source.account_id,status='active',bound_at=clock_timestamp(),updated_at=clock_timestamp()
        from (select principal_id,membership_id,account_id from identity.federatedidentity where realm_id=$4 and provider='wechat'
          and union_hash=$3 and status='active' and account_id is not null and membership_id is not null order by id limit 1) source
        where target.realm_id=$4 and target.provider='wechat' and target.application_hash=$1
          and target.subject_hash=$2 and target.status='unbound'`,
      [applicationHash, envelope.fingerprint, unionHash, realm.realmId]);
      const found = await database.query<{ id: string; principal_id: string | null; membership_id: string | null;
        account_id: string | null; realm_id: string; status: string }>(`select id,principal_id,membership_id,account_id,realm_id,status
        from identity.federatedidentity where realm_id=$1 and provider='wechat' and application_hash=$2 and subject_hash=$3 for update`,
      [realm.realmId, applicationHash, envelope.fingerprint]);
      const current = found.rows[0];
      if (!current || current.status === 'revoked') reject(403, 'WECHAT_IDENTITY_REVOKED');
      const requestingAccount = request.access === null ? null
        : await currentRealmAccount(database, request.access.membership.id, request.access.actor.id);
      const accountConfirmationRequired = request.access !== null && current.status === 'active'
        && current.account_id !== requestingAccount?.accountId;
      const result = accountConfirmationRequired
        ? await this.createGrant(database, current.id, 'account_confirmation_required')
        : current.status === 'active' && current.principal_id && current.membership_id
        ? await this.createSession(database, request, body, current.principal_id, current.membership_id, current.account_id!,
            current.realm_id, scene, authorization, returnTarget, scene === 'jsapi' ? realm as IdentityRealmContext : null)
        : await this.createGrant(database, current.id);
      const hash = operationRequestHash(request);
      await appendOperationAudit(this.audit, database, request, 'identity', result, current.principal_id ?? 'public:identity.wechat.session',
        current.membership_id ?? 'identity', hash);
      await completeIdempotency(database, request, 'identity', result);
      return result;
    });
  }

  private async createSession(database: import('../../../../foundation/application/ModuleOperations').OperationDatabase, request: OperationRequest,
    _body: Readonly<Record<string, unknown>>, principal: string, membershipid: string, account: string, accountRealm: string, scene: WechatScene,
    authorization: AuthTransaction | null, returnTarget: ReturnType<typeof authTarget> | null,
    realm: IdentityRealmContext | null): Promise<OperationResult> {
    const membership = await database.query<{ access_version: number; client: string; credential_version: number;
      auth_target: IdentityRealmContext['target'] }>(`select membership.access_version,membership.client,account.credential_version,target.target auth_target
      from access.membership membership join identity.account account
        on account.id=membership.account_id and account.realm_id=membership.realm_id
      join identity.realmtarget target on target.realm_id=account.realm_id
        and target.membership_client=membership.client and target.membership_organization_id=membership.organization_id
      where membership.id=$1 and account.id=$2 and account.realm_id=$3 and account.legacy_principal_id=$4
        and membership.status='active' and account.status='active'
        and ($5::text is null or (membership.client=$5 and membership.organization_id=$6))
        and ($7::text is null or target.target=$7)
      for update of account`, [membershipid, account, accountRealm, principal,
      realm?.membershipClient ?? null, realm?.membershipOrganizationId ?? null, realm?.target ?? null]);
    const active = membership.rows[0];
    if (!active) reject(403, 'WECHAT_MEMBERSHIP_INACTIVE');
    const token = randomBytes(48).toString('base64url');
    const session = `session:${randomUUID()}`;
    await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
      user_agent,device_label,assurance_level,realm_id,account_id,auth_target,expires_at,last_seen_at,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11,$12,$13,clock_timestamp()+interval '12 hours',clock_timestamp(),clock_timestamp())`,
    [session, principal, membershipid, tokenHash(token), active.credential_version, active.access_version, active.client,
      createHmac('sha256', this.sessionKey).update(request.input.headers['x-peer-address'] ?? 'unknown').digest('hex'),
      String(request.input.headers['user-agent'] ?? 'unknown').slice(0, 512), String(request.input.headers['x-device-id'] ?? 'wechat').slice(0, 128),
      accountRealm, account, active.auth_target]);
    await publishIdentityEvent(database, 'identity.session.created', session, membershipid, request.input.idempotency!, {
      principal, account, realm: accountRealm, membership: membershipid,
    });
    if (scene === 'jsapi') {
      if (!authorization || returnTarget === null || realm === null) throw new Error('AUTH_TRANSACTION_REQUIRED');
      if (authMembershipTarget(returnTarget) !== authTarget(active.client)) throw new Error('AUTH_RETURN_TARGET_INVALID');
      const csrf = randomBytes(32).toString('base64url');
      const callback = await this.tickets.issue(database, session, accountRealm, account, realm.target, authorization);
      return { status: 201, body: { session, csrf, expiresIn: 43_200, membership: membershipid, callback },
        headers: sessionCookies(token, csrf, 43_200) };
    }
    return { status: 201, body: { token, session, expiresIn: 43_200, membership: membershipid } };
  }

  private async createGrant(database: import('../../../../foundation/application/ModuleOperations').OperationDatabase, identity: string,
    state: 'registration_required' | 'account_confirmation_required' = 'registration_required'): Promise<OperationResult> {
    await database.query('update identity.wechatgrant set consumed_at=clock_timestamp() where identity_id=$1 and consumed_at is null', [identity]);
    const token = randomBytes(48).toString('base64url');
    await database.query(`insert into identity.wechatgrant(id,identity_id,token_hash,expires_at,created_at)
      values($1,$2,$3,clock_timestamp()+interval '10 minutes',clock_timestamp())`, [`wechatgrant:${randomUUID()}`, identity, tokenHash(token)]);
    return { status: 202, body: { bindingToken: token, expiresIn: 600, state } };
  }

  private async bind(request: OperationRequest): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    return identityTransaction(this.pool, request, async (database) => {
      const repeated = await beginIdempotency(database, request, access.scope.id);
      if (repeated) return repeated;
      const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
      const identity = await bindWechat(database, tokenHash(textField(body, 'bindingToken', 1024)), access.actor.id,
        access.membership.id, account.realmId, account.accountId);
      const result = { status: 200, body: { identity, status: 'active' } } satisfies OperationResult;
      await appendOperationAudit(this.audit, database, request, 'identity', result, access.actor.id, access.scope.id, operationRequestHash(request));
      await completeIdempotency(database, request, access.scope.id, result);
      return result;
    });
  }
}
