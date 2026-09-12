import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OperationId } from '@shop/contract';
import { operationLifecycle, pageResult, reject, requireAccess, type OperationActions } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, secretField, textField } from '../../../../foundation/interface/Validation';
import { requireAccessNodeContext, requireGovernanceContext } from '../../../../foundation/security/AccessContext';
import { PasswordPolicy } from '../../02_domain_yewu/policies_guize/PasswordPolicy';
import { AuthTransaction } from '../../02_domain_yewu/models_moxing/AuthTransaction';
import { publishIdentityEvent, tokenHash } from '../../04_adapters_shixian/persistence_cunchu/IdentityPersistence';
import { authMembershipTarget, authTarget, requestCookie, sessionCookies } from './IdentitySecurity';
import { memberPort } from '../../../member';
import { canonicalIdentitySubject, canonicalMobile } from '../../02_domain_yewu/models_moxing/IdentitySubject';
import { consumeSmsLoginChallenge, recordInvalidSmsLoginChallenge, resolvePasswordLoginCredential, verifySmsLoginChallenge } from '../../03_application_yingyong/services_fuwu/SmsLogin';
import { currentRealmAccount, resolveActiveMembershipContext, resolveRealmContext, resolveRealmNode } from '../../03_application_yingyong/services_fuwu/RealmAccount';
import { requireValidStorefront, type RealmOperationContext } from './RealmOperationContext';

export const SESSION_TICKET_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.loginintents.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.sessions.read',
  'identity.sessions.revoke',
] as const satisfies readonly OperationId[]);

export function sessionTicketOperations(runtime: RealmOperationContext): OperationActions {
  const { codeDigest, digest, kms, passwords, tickets } = runtime;
  return {
      'identity.sessions.create': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const requestedTarget = authTarget(textField(body, 'target', 32));
          const application = body.application === undefined ? undefined : textField(body, 'application', 48);
          const loginIntent = body.loginIntent === undefined ? undefined : secretField(body, 'loginIntent', 128);
          if (loginIntent !== undefined && !/^[A-Za-z0-9_-]{64}$/.test(loginIntent)) throw new Error('LOGIN_INTENT_INVALID');
          const authorization = AuthTransaction.start(body.authorization);
          const provider = body.provider === undefined ? 'password' : textField(body, 'provider', 32);
          if (provider !== 'password' && provider !== 'phone_otp') throw new Error('CREDENTIAL_PROVIDER_INVALID');
          const normalizedSubject = provider === 'phone_otp'
            ? canonicalMobile(textField(body, 'subject', 32))
            : canonicalIdentitySubject(textField(body, 'subject'));
          const subject = digest(normalizedSubject);
          const passwordMobile = provider === 'password' && /^\+[1-9][0-9]{7,14}$/.test(normalizedSubject)
            ? normalizedSubject
            : undefined;
          const mobileLookup = passwordMobile === undefined
            ? undefined
            : await kms.encrypt('identity/mobile', passwordMobile, { purpose: 'password_login' });
          const mobileTokens = passwordMobile === undefined
            ? undefined
            : [subject, mobileLookup!.fingerprint, createHash('sha256').update(passwordMobile).digest('hex')];
          return {
            body,
            provider,
            authorization,
            host: request.input.headers.host,
            requestedTarget,
            application,
            loginIntent,
            subject,
            mobileTokens,
          };
        },
        execute: async (request, database, { body, provider, authorization, host, requestedTarget, application, loginIntent, subject, mobileTokens }) => {
          const realm = await resolveRealmContext(database, host, requestedTarget, application);
          let found: Readonly<{ account_id: string; realm_id: string; principal_id: string; credential_version: number }> | undefined;
          let loginChallenge: string | undefined;
          let loginCode: string | undefined;
          if (provider === 'password') {
            const credentialFound = await resolvePasswordLoginCredential(database,
              mobileTokens === undefined
                ? { realmId: realm.realmId, subjectHash: subject }
                : { realmId: realm.realmId, subjectHash: subject, mobileTokens });
            if (!(await passwords.verify(secretField(body, 'password', 128), credentialFound?.secret_hash ?? null))) {
              reject(401, 'CREDENTIAL_INVALID');
            }
            if (credentialFound) found = credentialFound;
          } else {
            loginChallenge = textField(body, 'challenge', 128);
            loginCode = textField(body, 'code', 16);
            found = await verifySmsLoginChallenge(database, {
              realmId: realm.realmId,
              id: loginChallenge,
              codeHash: codeDigest(loginChallenge, loginCode),
              destinationHash: subject,
            });
            if (!found) {
              await recordInvalidSmsLoginChallenge(database, loginChallenge, subject);
              reject(401, 'CREDENTIAL_INVALID');
            }
          }
          if (!found) reject(401, 'CREDENTIAL_INVALID');
          const memberships = await database.query<{ id: string; access_version: number; client: string; organization_id: string }>(
            `select membership.id,membership.access_version,membership.client,membership.organization_id from access.membership membership
          where membership.account_id=$1 and membership.realm_id=$2 and membership.status='active'
            and membership.client=$3 and membership.organization_id=$4
          order by membership.id`,
            [found.account_id, found.realm_id, realm.membershipClient, realm.membershipOrganizationId]
          );
          const candidates = memberships.rows.filter((item) => item.client === realm.membershipClient
            && item.organization_id === realm.membershipOrganizationId);
          if (realm.surface === 'consumer') {
            const storefront = await requireValidStorefront(memberPort.storefrontRegistration(database, realm.application!));
            if (storefront.application_slug !== realm.application
              || storefront.organization_id !== realm.membershipOrganizationId) reject(400, 'AUTH_REALM_MISMATCH');
          }
          if (candidates.length === 0) reject(403, 'REALM_MEMBERSHIP_NOT_FOUND');
          const requested = typeof body.membership === 'string' ? body.membership : undefined;
          const membership = requested ? candidates.find((item) => item.id === requested) : candidates.length === 1 ? candidates[0] : undefined;
          if (requested !== undefined && membership === undefined) reject(403, 'MEMBERSHIP_INACTIVE');
          if (!membership) {
            return {
              status: 200,
              body: {
                principal: found.principal_id,
                memberships: candidates.map(({ id, client }) => ({ id, client: authTarget(client) })),
              },
            };
          }
          const activeContext = await resolveActiveMembershipContext(
            database, realm.realmId, found.account_id, membership.id,
          );
          if (provider === 'phone_otp') {
            const consumed = await consumeSmsLoginChallenge(database, {
              id: loginChallenge!,
              codeHash: codeDigest(loginChallenge!, loginCode!),
              account: found.account_id,
              realmId: found.realm_id,
              destinationHash: subject,
            });
            if (!consumed) reject(401, 'CREDENTIAL_INVALID');
          }
          const token = randomBytes(48).toString('base64url');
          const id = `session:${randomUUID()}`;
          const assurance = provider === 'phone_otp' ? 2 : 1;
          await database.query(
            `insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,device_label,
              assurance_level,realm_id,account_id,auth_target,expires_at,last_seen_at,created_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,clock_timestamp()+interval '12 hours',clock_timestamp(),clock_timestamp())`,
            [
              id,
              found.principal_id,
              membership.id,
              tokenHash(token),
              found.credential_version,
              membership.access_version,
              membership.client,
              digest(request.input.headers['x-peer-address'] ?? 'unknown'),
              String(request.input.headers['user-agent'] ?? 'unknown').slice(0, 512),
              String(request.input.headers['x-device-id'] ?? 'browser').slice(0, 128),
              assurance,
              found.realm_id,
              found.account_id,
              realm.target,
            ]
          );
          if (provider === 'phone_otp') {
            await database.query(
              `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
              values($1,$2,$3,'phone_otp',2,$4,clock_timestamp(),clock_timestamp()+interval '12 hours',$5,$6)`,
              [`assurance:${randomUUID()}`, found.principal_id, id, createHash('sha256').update(loginChallenge!).digest('hex'), found.realm_id, found.account_id]
            );
          }
          const consumedIntent = loginIntent === undefined ? undefined : (await database.query<{
            login_intent_id: string;
            source_realm_id: string;
            source_node_id: string;
            source_account_id: string;
            source_session_id: string;
            target_node_id: string;
          }>(`select * from identity.consume_login_intent($1,$2,$3,$4,$5,$6)`, [
            tokenHash(loginIntent), realm.realmId, realm.target, realm.application ?? null, found.account_id, id,
          ])).rows[0];
          if (loginIntent !== undefined && consumedIntent === undefined) reject(403, 'LOGIN_INTENT_INVALID');
          await publishIdentityEvent(database, 'identity.session.created', id, membership.id, request.input.idempotency!, {
            principal: found.principal_id,
            account: found.account_id,
            membership: membership.id,
            realm: { entryRealmId: realm.realmId, currentRealmId: found.realm_id, nodeId: activeContext.node_id, surface: realm.surface },
            assurance,
            loginMethod: provider,
            ...(consumedIntent === undefined ? {} : {
              loginIntent: consumedIntent.login_intent_id,
              sourceRealm: consumedIntent.source_realm_id,
              sourceNode: consumedIntent.source_node_id,
            }),
          });
          const csrf = randomBytes(32).toString('base64url');
          const target = authMembershipTarget(realm.target);
          const callback = await tickets.issue(database, id, found.realm_id, found.account_id, realm.target, authorization);
          return { status: 201, body: { session: id, csrf, expiresIn: 43_200, membership: membership.id,
            target, callback, active_context: activeContext }, headers: sessionCookies(token, csrf, 43_200) };
        },
      }),
      'identity.loginintents.create': async (request, database) => {
        const access = requireAccess(request);
        const sourceNode = requireAccessNodeContext(access);
        if (!access.actor.account || !access.actor.realm) throw new Error('AUTH_REALM_CONTEXT_MISSING');
        const body = bodyRecord(request);
        const targetNodeId = textField(body, 'targetNodeId', 96);
        if (!/^node:[a-z0-9][a-z0-9-]{0,62}:l[0-9]{1,3}$/.test(targetNodeId)) {
          throw new Error('LOGIN_INTENT_TARGET_NODE_INVALID');
        }
        const targetSurface = textField(body, 'targetSurface', 16);
        if (targetSurface !== 'admin' && targetSurface !== 'consumer') throw new Error('LOGIN_INTENT_TARGET_SURFACE_INVALID');
        const targetApplication = body.targetApplication === undefined
          ? undefined
          : textField(body, 'targetApplication', 48);
        if ((targetSurface === 'consumer') !== (targetApplication !== undefined)) {
          throw new Error('LOGIN_INTENT_TARGET_APPLICATION_INVALID');
        }
        if (targetNodeId === sourceNode.node_id) throw new Error('LOGIN_INTENT_CROSS_NODE_REQUIRED');
        const token = randomBytes(48).toString('base64url');
        const id = `loginintent:${randomUUID()}`;
        const issued = (await database.query<{
          target_realm_id: string;
          target_accounts_host: string;
          target_target: string;
          target_application: string | null;
          target_return_origin: string;
        }>('select * from identity.issue_login_intent($1,$2,$3,$4,$5,$6,$7,$8)', [
          id, tokenHash(token), access.actor.session, access.actor.account, access.actor.realm,
          targetNodeId, targetSurface, targetApplication ?? null,
        ])).rows[0];
        if (issued === undefined) reject(403, 'LOGIN_INTENT_TARGET_INVALID');
        const loginUrl = new URL(`https://${issued.target_accounts_host}`);
        loginUrl.searchParams.set('target', issued.target_target);
        if (targetSurface === 'consumer') loginUrl.searchParams.set('surface', 'web');
        if (issued.target_application !== null) loginUrl.searchParams.set('application', issued.target_application);
        loginUrl.searchParams.set('login_intent', token);
        return {
          status: 201,
          body: {
            loginIntent: id,
            sourceNode: sourceNode.node_id,
            targetNode: targetNodeId,
            targetRealm: issued.target_realm_id,
            targetSurface,
            returnOrigin: issued.target_return_origin,
            loginUrl: loginUrl.toString(),
            expiresIn: 300,
          },
        };
      },
      'identity.tickets.exchange': async (request, database) => {
        const currentToken = requestCookie(request.input.headers.cookie, 'shop_session');
        if (!currentToken) reject(401, 'AUTHENTICATION_REQUIRED');
        const realm = await resolveRealmNode(database, request.input.headers.host);
        const exchanged = await tickets.consume(database, request.input.body, currentToken, realm.realmId);
        const expiresIn = Math.max(1, Math.min(43_200, Math.floor((exchanged.sessionExpiresAt.getTime() - Date.now()) / 1_000)));
        return {
          status: 200,
          body: { returnTarget: exchanged.returnTarget, expiresIn },
        };
      },
      'identity.session.read': async (request, database) => {
        const access = requireAccess(request);
        const governance = requireGovernanceContext(access);
        const permissions = [...new Set(access.membership.grants.flatMap((grant) => grant.permissions).filter((permission) => !access.membership.denies.includes(permission)))].sort();
        const scopes = [...new Map(access.membership.grants.map((grant) => [grant.scope.id, grant.scope] as const)).values()];
        const csrf = requestCookie(request.input.headers.cookie, 'shop_csrf');
        const realmAccount = await currentRealmAccount(database, access.membership.id, access.actor.id);
        const entryRealmId = access.actor.nodeContext?.manifest.realm_ref.ref ?? realmAccount.realmId;
        const [activeContext, credential, member, accountState] = await Promise.all([
          resolveActiveMembershipContext(database, entryRealmId, realmAccount.accountId, access.membership.id),
          database.query<{ rotated_at: Date | null }>(
            `select rotated_at from identity.credential
          where account_id=$1 and realm_id=$2 and provider='password' and status='active' order by created_at desc limit 1`,
            [realmAccount.accountId, realmAccount.realmId]
          ),
          memberPort.securityProfile(database, access.actor.id),
          database.query<{ mobile_masked: string | null }>(`select mobile_masked from identity.account where id=$1 and realm_id=$2`,
            [realmAccount.accountId, realmAccount.realmId]),
        ]);
        return {
          status: 200,
          body: {
            actor: access.actor.id,
            session: access.actor.session,
            membership: access.membership.id,
            active_context: activeContext,
            scope: access.scope,
            scopes,
            accessVersion: access.accessVersion,
            permissions,
            capabilities: access.capabilities,
            assurance: access.assurance,
            target: access.actor.target,
            governance: {
              level: governance.governanceLevel,
              exactOwner: governance.isExactOwner,
              organization: governance.organizationId,
            },
            ...(member.displayName === null ? {} : {
              profile: { display_name: member.displayName, employee_no: null },
            }),
            security: { hasLocalCredential: credential.rows.length > 0, phoneMasked: accountState.rows[0]?.mobile_masked ?? null,
              passwordChangedAt: credential.rows[0]?.rotated_at?.toISOString() ?? null },
            syncedAt: new Date().toISOString(),
            ...(csrf === undefined ? {} : { csrf }),
          },
        };
      },
      'identity.session.delete': async (request, database) => {
        const access = requireAccess(request);
        const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
        const result = await database.query(`update identity.session set revoked_at=clock_timestamp(),revoked_reason='logout'
          where id=$1 and account_id=$2 and realm_id=$3 and revoked_at is null returning id,revoked_at`,
        [access.actor.session, account.accountId, account.realmId]);
        const sessions = result.rows.length === 0 ? [] : [access.actor.session];
        await publishIdentityEvent(database, 'identity.session.revoked', access.actor.session, access.membership.id, request.input.idempotency!, { sessions, reason: 'logout' });
        return {
          status: 200,
          body: { target: access.actor.session, revoked: sessions.length, sessions },
          headers: sessionCookies('', '', 0),
        };
      },
      'identity.sessions.read': async (request, database) => {
        const access = requireAccess(request);
        const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
        const result = await database.query(
          `select id,membership_id as membership,client,device_label as "deviceLabel",user_agent as "userAgent",
        assurance_level as assurance,created_at as "createdAt",last_seen_at as "lastSeenAt",expires_at as "expiresAt",id=$3 as current
        from identity.session where account_id=$1 and realm_id=$2 and revoked_at is null and expires_at>clock_timestamp()
        order by (id=$3) desc,last_seen_at desc,id limit 100`,
          [account.accountId, account.realmId, access.actor.session]
        );
        return pageResult(result);
      },
      'identity.sessions.revoke': async (request, database) => {
        const access = requireAccess(request);
        const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
        const session = request.input.path.sessionid;
        if (!session) reject(404, 'RESOURCE_NOT_FOUND');
        const result =
          session === 'others'
            ? await database.query<{ id: string }>(
                `update identity.session set revoked_at=clock_timestamp(),revoked_reason='security_center'
            where account_id=$1 and realm_id=$2 and id<>$3 and revoked_at is null returning id`,
                [account.accountId, account.realmId, access.actor.session]
              )
            : await database.query<{ id: string }>(
                `update identity.session set revoked_at=clock_timestamp(),revoked_reason='security_center'
            where account_id=$1 and realm_id=$2 and id=$3 and revoked_at is null returning id`,
                [account.accountId, account.realmId, session]
              );
        if (session !== 'others' && result.rowCount === 0) {
          const owned = await database.query<{ revoked_at: Date | null }>(
            'select revoked_at from identity.session where account_id=$1 and realm_id=$2 and id=$3',
            [account.accountId, account.realmId, session]);
          if (!owned.rows[0]) reject(404, 'RESOURCE_NOT_FOUND');
        }
        const sessions = result.rows.map(({ id }) => id);
        if (sessions.length > 0) await publishIdentityEvent(database, 'identity.session.revoked', session, access.membership.id, request.input.idempotency!, { sessions, reason: 'security_center' });
        const response = { status: 200, body: { target: session, revoked: sessions.length, sessions } } as const;
        return session === access.actor.session ? { ...response, headers: sessionCookies('', '', 0) } : response;
      },
  };
}
