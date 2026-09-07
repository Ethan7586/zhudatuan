import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { canonicalFinancialActionRequest, requiresFinancialActionProof, requiresFinancialExpectedVersion, type OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, pageResult, reject, requireAccess, rowResult, type OperationActions, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, secretField, textField } from '../../../../foundation/interface/Validation';
import type { OperationRequest, OperationUsecase } from '../../../../foundation/application/OperationHandler';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { requireGovernanceContext } from '../../../../foundation/security/AccessContext';
import { StepupPolicy } from '../../../../foundation/security/StepupPolicy';
import { IDENTITY_SECURITY_KEYS } from '../../../../foundation/infrastructure/SecretStore';
import { PasswordPolicy } from '../../02_domain_yewu/policies_guize/PasswordPolicy';
import { bindWechat, completeWechatBinding, prepareWechatBinding, publishIdentityEvent, tokenHash } from '../../04_adapters_shixian/persistence_cunchu/IdentityPersistence';
import { AuthTransaction } from '../../02_domain_yewu/models_moxing/AuthTransaction';
import { PgAuthTicket } from '../../04_adapters_shixian/persistence_cunchu/PgAuthTicket';
import { RETURN_TARGETS } from '../../04_adapters_shixian/providers_waibu/ReturnTargetCatalog';
import { ReturnTargetSigner } from '../../04_adapters_shixian/providers_waibu/ReturnTargetSigner';
import { authMembershipTarget, authTarget, consumeChallenge, requestCookie, sessionCookies } from './IdentitySecurity';
import { accessPort } from '../../../access';
import { memberPort, type MemberInvite } from '../../../member';
import { organizationPort } from '../../../organization';
import { canonicalIdentitySubject, canonicalMobile } from '../../02_domain_yewu/models_moxing/IdentitySubject';
import { consumeSmsLoginChallenge, recordInvalidSmsLoginChallenge, resolveBoundMobileAccount, resolvePasswordLoginCredential, verifySmsLoginChallenge } from '../../03_application_yingyong/services_fuwu/SmsLogin';
import { currentRealmAccount, resolveRealmApplication, resolveRealmContext, resolveRealmNode } from '../../03_application_yingyong/services_fuwu/RealmAccount';

export const IDENTITY_CORE_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.sessions.read',
  'identity.sessions.revoke',
  'identity.challenges.create',
  'identity.invitations.read',
  'identity.storefronts.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.members.create',
  'identity.members.manage',
  'identity.members.reset',
  'identity.password.change',
  'identity.password.verify',
  'identity.password.reset',
  'identity.mobile.challenge',
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
] as const satisfies readonly OperationId[]);

const IDENTITY_REGISTRATION_CORE_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.challenges.create',
  'identity.invitations.read',
  'identity.storefronts.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.members.create',
  'identity.password.reset',
  'identity.password.verify',
  'identity.mobile.challenge',
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
] as const satisfies readonly OperationId[]);

export const IDENTITY_REGISTRATION_OPERATION_IDS = Object.freeze([
  ...IDENTITY_REGISTRATION_CORE_OPERATION_IDS,
  'identity.wechat.session',
  'identity.wechat.bind',
] as const satisfies readonly OperationId[]);

export function identityRegistrationOperations(context: ModuleContext): OperationUsecase {
  return identityCoreOperations(context, IDENTITY_REGISTRATION_CORE_OPERATION_IDS, true);
}

export function identityOperations(context: ModuleContext): OperationUsecase {
  return identityCoreOperations(context, IDENTITY_CORE_OPERATION_IDS, false);
}

function identityCoreOperations(context: ModuleContext, ownedOperations: readonly OperationId[], registrationOnly: boolean): OperationUsecase {
  const pool = context.container.get(DATABASE_POOL);
  const audit = context.container.get(AUDIT_SINK);
  const keys = context.container.get(IDENTITY_SECURITY_KEYS);
  const kms = context.container.get(KMS_CLIENT);
  const passwords = new PasswordPolicy();
  const stepup = new StepupPolicy();
  const tickets = new PgAuthTicket(new ReturnTargetSigner(context.container.get(RETURN_TARGETS), keys.session));
  const digest = (value: string) => createHmac('sha256', keys.identity).update(value.trim().toLowerCase()).digest('hex');
  const codeDigest = (challenge: string, code: string) => createHmac('sha256', keys.session).update(`${challenge}:${code}`).digest('hex');
  const sessionDigest = (session: string) => createHash('sha256').update(session).digest('hex');
  const actions: OperationActions = {
      'identity.sessions.create': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const requestedTarget = authTarget(textField(body, 'target', 32));
          const application = body.application === undefined ? undefined : textField(body, 'application', 48);
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
            subject,
            mobileTokens,
          };
        },
        execute: async (request, database, { body, provider, authorization, host, requestedTarget, application, subject, mobileTokens }) => {
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
            [found.account_id, realm.realmId, realm.membershipClient, realm.membershipOrganizationId]
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
          if (provider === 'phone_otp') {
            const consumed = await consumeSmsLoginChallenge(database, {
              id: loginChallenge!,
              codeHash: codeDigest(loginChallenge!, loginCode!),
              account: found.account_id,
              realmId: realm.realmId,
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
              realm.realmId,
              found.account_id,
              realm.target,
            ]
          );
          if (provider === 'phone_otp') {
            await database.query(
              `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
              values($1,$2,$3,'phone_otp',2,$4,clock_timestamp(),clock_timestamp()+interval '12 hours',$5,$6)`,
              [`assurance:${randomUUID()}`, found.principal_id, id, createHash('sha256').update(loginChallenge!).digest('hex'), realm.realmId, found.account_id]
            );
          }
          await publishIdentityEvent(database, 'identity.session.created', id, membership.id, request.input.idempotency!, {
            principal: found.principal_id,
            account: found.account_id,
            membership: membership.id,
            realm: { nodeId: realm.nodeId, surface: realm.surface },
            assurance,
            loginMethod: provider,
          });
          const csrf = randomBytes(32).toString('base64url');
          const target = authMembershipTarget(realm.target);
          const callback = await tickets.issue(database, id, realm.realmId, found.account_id, realm.target, authorization);
          return { status: 201, body: { session: id, csrf, expiresIn: 43_200, membership: membership.id, target, callback }, headers: sessionCookies(token, csrf, 43_200) };
        },
      }),
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
        const [credential, member, accountState] = await Promise.all([
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
        const response = rowResult(result);
        await publishIdentityEvent(database, 'identity.session.revoked', access.actor.session, access.membership.id, request.input.idempotency!, { sessions: [access.actor.session], reason: 'logout' });
        return { ...response, headers: sessionCookies('', '', 0) };
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
      'identity.challenges.create': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const id = `challenge:${randomUUID()}`;
          const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
          const purpose = textField(body, 'purpose');
          if (registrationOnly && purpose !== 'registration' && purpose !== 'login' && purpose !== 'password_reset') reject(400, 'CHALLENGE_PURPOSE_INVALID');
          if (!['registration', 'login', 'password_reset', 'wechat_bind'].includes(purpose)) throw new Error('CHALLENGE_PURPOSE_INVALID');
          const requestedDestination = textField(body, 'destination').trim();
          const destination = purpose === 'registration' || purpose === 'login' || purpose === 'password_reset'
            ? canonicalMobile(requestedDestination) : requestedDestination;
          const destinationHash = digest(destination);
          const registration = purpose === 'registration' ? registrationReference(body) : undefined;
          const registrationHash = registration === undefined ? undefined
            : digest(registration.kind === 'invite' ? registration.value : `storefront:${registration.value}`);
          const resolvesBoundMobile = purpose === 'login' || purpose === 'password_reset';
          const legacyMobileToken = resolvesBoundMobile ? createHash('sha256').update(destination).digest('hex') : undefined;
          const [envelope, recipient, mobileLookup] = await Promise.all([
            kms.encrypt('identity/challenge', code, { challenge: id, purpose }),
            kms.encrypt('identity/destination', destination, { challenge: id, purpose }),
            resolvesBoundMobile ? kms.encrypt('identity/mobile', destination, { challenge: id, purpose }) : Promise.resolve(undefined),
          ]);
          return { body, id, code, purpose, destinationHash, registration, registrationHash, legacyMobileToken, envelope, recipient, mobileLookup };
        },
        execute: async (request, database, prepared) => {
          const { body, id, code, purpose, destinationHash, registration, registrationHash, legacyMobileToken, envelope, recipient, mobileLookup } = prepared;
          const realm = await resolveRealmNode(database, request.input.headers.host);
          if (purpose === 'registration') {
            if (!registration || !registrationHash) throw new Error('REGISTRATION_CONTEXT_INVALID');
            if (registration.kind === 'invite') {
              await requireValidInvite(memberPort.assertRegistrationInvite(database, registrationHash, destinationHash));
            } else {
              await requireValidStorefront(memberPort.storefrontRegistration(database, registration.value));
            }
          }
          let principal = typeof body.principal === 'string' ? body.principal : null;
          let account: string | null = null;
          if (purpose === 'login' || purpose === 'password_reset') {
            const bound = await resolveBoundMobileAccount(database, realm.realmId, [destinationHash, mobileLookup!.fingerprint, legacyMobileToken!]);
            principal = bound?.principal_id ?? null;
            account = bound?.account_id ?? null;
          }
          const result = await database.query(
            `with challenge as (
          insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at,realm_id,account_id)
          values($1,$2,$3,$4,$5,0,clock_timestamp()+interval '10 minutes',clock_timestamp(),$10,$11) returning id,purpose,expires_at
        ), secret as (insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,destination_key_version,created_at)
          values($1,$6,$7,$8,$9,clock_timestamp())) select * from challenge`,
            [id, principal, purpose, destinationHash, codeDigest(id, registrationHash === undefined ? code : `${code}:${registrationHash}`), envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion, realm.realmId, account]
          );
          await database.query(
            `insert into runtime.job(id,kind,owner,payload,state,priority,available_at,created_at,updated_at)
          select $1,'identitynotification','identity',jsonb_build_object('challenge',$2::text),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp()
          where $3::text is not null`,
            [`job:notify:${id}`, id, purpose === 'login' ? principal : 'public-challenge']
          );
          await publishIdentityEvent(database, 'identity.challenge.started', id, 'identity', request.input.idempotency!, {
            challenge: id, destination: destinationHash, purpose, realm: realm.realmId, ...(account === null ? {} : { account }),
          });
          return rowResult(result, 202);
        },
      }),
      'identity.invitations.read': async (request, database) => {
        const body = bodyRecord(request);
        const result = await memberPort.invite(database, digest(textField(body, 'invite')));
        return rowResult(result);
      },
      'identity.storefronts.read': async (request, database) => {
        const body = bodyRecord(request);
        const storefront = await requireValidStorefront(memberPort.storefrontRegistration(database, storefrontSlug(body)));
        return {
          status: 200,
          body: {
            terms_title: storefront.terms_title,
            terms_body: storefront.terms_body,
            privacy_title: storefront.privacy_title,
            privacy_body: storefront.privacy_body,
            terms_hash: storefront.terms_hash,
            application_id: storefront.application_id,
            application_slug: storefront.application_slug,
            organization_id: storefront.organization_id,
            organization_name: storefront.organization_name,
            target_client: 'storefront',
          },
        };
      },
      'identity.invitations.create': async (request, database) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const label = textField(body, 'label', 80);
        const requestedTarget = body.targetClient;
        if (requestedTarget !== undefined && requestedTarget !== 'storefront' && requestedTarget !== 'operator') throw new Error('INVALID_INVITATION_INPUT');
        const targetClient = registrationOnly ? 'operator' : requestedTarget ?? 'storefront';
        const governanceLevel = invitationGovernanceLevel(body.governanceLevel, targetClient);
        const invitationScope = access.scope.kind === 'platform' && targetClient === 'operator'
          ? textField(body, 'tenantId') : access.scope.id;
        if (access.scope.kind === 'platform' && targetClient === 'operator') {
          const target = await database.query<{ id: string }>(`select organization.id from organization.organization organization
          where organization.id=$1 and organization.kind='tenant' and organization.status='active'
            and access.scope_allowed(organization.id)`, [invitationScope]);
          if (target.rows[0]?.id !== invitationScope) reject(403, 'PERMISSION_DENIED');
          await database.query(`select set_config('app.scope_id',$1,true)`, [invitationScope]);
        }
        requireInvitationManager(request);
        if (governanceLevel === 'senior_administrator' && !requireGovernanceContext(access).isExactOwner) {
          reject(403, 'PERMISSION_DENIED');
        }
        if (registrationOnly && requestedTarget !== undefined && requestedTarget !== 'operator') throw new Error('INVALID_INVITATION_INPUT');
        const maxUses = integerField(body, 'maxUses', 1);
        const expiresAt = inviteExpiry(body.expiresAt);
        if (label.length < 2 || maxUses > 500 || (targetClient === 'operator' && maxUses !== 1)) throw new Error('INVALID_INVITATION_INPUT');
        if (targetClient === 'operator' && access.scope.kind !== 'platform'
          && (access.scope.kind !== 'tenant' || access.scope.id !== access.scope.tenant)) throw new Error('INVITATION_SCOPE_INVALID');
        if (targetClient === 'storefront' && access.scope.kind !== 'mall') throw new Error('INVITATION_SCOPE_INVALID');
        const destination = targetClient === 'operator' ? canonicalMobile(textField(body, 'destination', 32)) : null;
        const destinationHash = destination === null ? null : digest(destination);
        const requestedStorefront = typeof body.storefrontOrganization === 'string' && body.storefrontOrganization.trim().length > 0
          ? body.storefrontOrganization.trim() : null;
        const storefronts = targetClient === 'operator'
          ? await database.query<{ id: string }>(`select storefront.id from organization.organization storefront
            join organization.unitclosure closure on closure.descendant_id=storefront.id
            where closure.ancestor_id=$1 and storefront.kind='mall' and storefront.status='active'
              and ($2::text is null or storefront.id=$2) order by storefront.id limit 2`, [invitationScope, requestedStorefront])
          : { rows: [] };
        if (targetClient === 'operator' && storefronts.rows.length !== 1) throw new Error('STOREFRONT_SCOPE_REQUIRED');
        const roleId = targetClient === 'operator'
          ? governanceLevel === 'senior_administrator'
            ? seniorAdministratorRoleId(invitationScope)
            : 'role-zhudatuan-pending-operator'
          : invitationScope === 'mall-zhudatuan'
            ? 'role-zhudatuan-storefront-member'
            : `role-zhudatuan-storefront-member:${invitationScope}`;
        const role = await database.query<{ id: string }>(`select role.id from access.role role where role.id=$1
        and role.status='active' and role.scope_id=$2
        and ($3::text is distinct from 'administrator' or not exists(
          select 1 from access.rolepermission pendingpermission where pendingpermission.role_id=role.id))`,
        [roleId, invitationScope, governanceLevel]);
        if (role.rows[0]?.id !== roleId) throw new Error('EMPLOYEE_ROLE_NOT_FOUND');
        const policy = await database.query<{ id: string; terms_hash: string }>(`select id,terms_hash from identity.registrationpolicy
        where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp()) order by version desc limit 1`);
        if (!policy.rows[0]) throw new Error('INVITE_INVALID');
        const id = `invite:${randomUUID()}`;
        const code = `${'ABCDEF'.charAt(randomInt(6))}${'ABCDEF'.charAt(randomInt(6))}${randomBytes(4).toString('hex').toUpperCase()}`;
        const result = await database.query(
          `insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
        role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,registration_policy_id,terms_hash,version,
        target_client,storefront_organization_id,destination_masked)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,clock_timestamp(),'active',clock_timestamp(),$11,$12,0,$13,$14,$15)
        returning id,label,case target_client when 'operator' then 'console' else target_client end target,
          max_uses,use_count,effective_at starts_at,expires_at,status,created_at,version`,
          [id, invitationScope, label, destinationHash ?? digest(id), digest(code), expiresAt, access.membership.id,
            role.rows[0].id, destinationHash, maxUses, policy.rows[0].id, policy.rows[0].terms_hash,
            targetClient, storefronts.rows[0]?.id ?? null, destination === null ? null : maskInvitationMobile(destination)]
        );
        const saved = result.rows[0];
        if (!saved) throw new Error('INVITE_INVALID');
        return { status: 201, body: { ...saved, code, ...(governanceLevel === null ? {} : { governanceLevel }) }, headers: { etag: '"0"' } };
      },
      'identity.invitations.revoke': async (request, database) => {
        const { invitationAuthority } = requireInvitationManager(request);
        const body = bodyRecord(request);
        const reason = textField(body, 'reason', 1000);
        if (reason.length < 4) throw new Error('CHANGE_REASON_REQUIRED');
        const id = request.input.path.invitationid!;
        const result = await database.query(
          `update member.invite set status='disabled',version=version+1
        where id=$1 and access.scope_allowed(organization_id)
          and (not $3::boolean or (target_client='operator' and organization_id='tenant-zhudatuan'))
          and (target_client<>'operator' or $4::boolean)
          and status='active' and ($2::bigint is null or version=$2)
        returning id,label,target_client,max_uses,use_count,effective_at starts_at,expires_at,status,created_at,version`,
          [id, request.input.expectedVersion ?? null, registrationOnly, invitationAuthority]
        );
        if (result.rows[0]) return rowResult(result);
        const current = await database.query<{ status: string; version: number }>(
          `select status,version from member.invite
        where id=$1 and access.scope_allowed(organization_id)
          and (not $2::boolean or (target_client='operator' and organization_id='tenant-zhudatuan'))
          and (target_client<>'operator' or $3::boolean)`,
          [id, registrationOnly, invitationAuthority]
        );
        if (!current.rows[0]) throw new Error('INVITATION_NOT_FOUND');
        if (request.input.expectedVersion !== undefined && current.rows[0].version !== request.input.expectedVersion) throw new Error('VERSION_CONFLICT');
        if (current.rows[0].status === 'active') throw new Error('VERSION_CONFLICT');
        return { status: 200, body: { id, status: current.rows[0].status, version: current.rows[0].version }, headers: { etag: `"${String(current.rows[0].version)}"` } };
      },
      'identity.members.create': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const subject = canonicalMobile(textField(body, 'subject'));
          const principal = `principal:${randomUUID()}`;
          const [password, mobile] = await Promise.all([
            passwords.hash(secretField(body, 'password', 128)),
            kms.encrypt('identity/mobile', subject, { principal }),
          ]);
          return {
            body,
            subject,
            password,
            principal,
            account: `account:${randomUUID()}`,
            mobile,
            authorization: body.authorization === undefined ? null : AuthTransaction.start(body.authorization),
            assurance: `assurance:${randomUUID()}`,
            member: `member:${randomUUID()}`,
            membership: `membership:${randomUUID()}`,
            operatorMembership: `membership:${randomUUID()}`,
            credential: `credential:${randomUUID()}`,
            scopes: [`scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`] as const,
          };
        },
        execute: async (request, database, prepared) => {
          const { body, subject, password, principal, account, mobile, authorization, assurance, member, membership, operatorMembership, credential, scopes } = prepared;
          const realm = await resolveRealmNode(database, request.input.headers.host);
          const requestedReturnTarget = authorization === null || typeof body.target !== 'string' ? undefined : authTarget(body.target);
          if (authorization !== null && (requestedReturnTarget === undefined || authMembershipTarget(requestedReturnTarget) !== 'storefront')) {
            throw new Error('AUTH_RETURN_TARGET_INVALID');
          }
          const subjectHash = digest(subject);
          await database.query('select pg_advisory_xact_lock(hashtext($1))', [`${realm.realmId}:${subjectHash}`]);
          const mobileTokens = [subjectHash, mobile.fingerprint, createHash('sha256').update(subject).digest('hex')];
          const boundAccount = await resolveBoundMobileAccount(database, realm.realmId, mobileTokens);
          let existing = await database.query<{ account_id: string; principal_id: string; credential_version: number }>(
            `select account.id account_id,account.legacy_principal_id principal_id,account.credential_version
            from identity.credential credential join identity.account account
              on account.id=credential.account_id and account.realm_id=credential.realm_id
            where credential.realm_id=$1 and credential.provider='password' and credential.subject_hash=$2
              and credential.status='active' and account.status='active'
            order by credential.created_at,credential.id limit 1 for update of credential,account`,
            [realm.realmId, subjectHash]
          );
          if (boundAccount !== null && existing.rows[0]?.account_id !== boundAccount.account_id) {
            existing = await database.query<{ account_id: string; principal_id: string; credential_version: number }>(
              `select account.id account_id,account.legacy_principal_id principal_id,account.credential_version
              from identity.account account where account.id=$1 and account.realm_id=$2 and account.status='active'
                and exists (select 1 from identity.credential credential where credential.account_id=account.id
                  and credential.realm_id=account.realm_id and credential.provider='password' and credential.status='active')
              for update of account`,
              [boundAccount.account_id, realm.realmId]
            );
            if (!existing.rows[0]) reject(409, 'IDENTITY_SUBJECT_EXISTS');
          }
          if (existing.rows[0] && authorization === null) reject(409, 'IDENTITY_SUBJECT_EXISTS');
          const registration = registrationReference(body);
          const registrationHash = digest(registration.kind === 'invite' ? registration.value : `storefront:${registration.value}`);
          const deferredPhoneVerification = registration.kind === 'storefront' && body.phoneVerification === 'checkout';
          if (!deferredPhoneVerification) {
            await consumeChallenge(database, textField(body, 'challenge'), textField(body, 'code'),
              (challenge, code) => codeDigest(challenge, `${code}:${registrationHash}`), undefined,
              { purpose: 'registration', destinationHash: subjectHash, realmId: realm.realmId });
          }
          let registrationTarget: MemberInvite;
          let applicationReturnTarget: ReturnType<typeof authTarget> | undefined;
          if (registration.kind === 'invite') {
            registrationTarget = await requireValidInvite(memberPort.consumeInvite(database, registrationHash, subjectHash, operatorMembership));
          } else {
            const storefront = await requireValidStorefront(memberPort.storefrontRegistration(database, registration.value));
            const applicationRealm = await resolveRealmApplication(database, realm.realmId, storefront.application_slug);
            if (applicationRealm.membershipOrganizationId !== storefront.organization_id) throw new Error('AUTH_REALM_MISMATCH');
            applicationReturnTarget = applicationRealm.target;
            if (requestedReturnTarget !== undefined && requestedReturnTarget !== applicationReturnTarget) {
              throw new Error('AUTH_RETURN_TARGET_INVALID');
            }
            registrationTarget = {
              id: `storefront:${storefront.application_id}`,
              organization_id: storefront.organization_id,
              created_by: '',
              role_id: storefront.role_id,
              target_client: 'storefront',
              terms_hash: storefront.terms_hash,
              storefront_organization_id: null,
              governance_level: null,
            };
            await database.query(`select set_config('app.registration_mall_id',$1,true)`, [storefront.organization_id]);
            if (deferredPhoneVerification) {
              await database.query(`select set_config('app.registration_phone_verification','checkout',true)`);
            }
          }
          if (authorization !== null && registrationTarget.target_client !== 'storefront') throw new Error('AUTH_RETURN_TARGET_INVALID');
          const organization = registrationTarget.organization_id;
          if (body.termsAccepted !== true || body.termsHash !== registrationTarget.terms_hash) throw new Error('TERMS_ACCEPTANCE_REQUIRED');
          let resolvedPrincipal = principal;
          let resolvedAccount = account;
          let resolvedMember = member;
          let credentialVersion = 1;
          let result: Readonly<Record<string, unknown>>;
          const scopeKind = await organizationPort.kind(database, organization);
          if (existing.rows[0]) {
            resolvedPrincipal = existing.rows[0].principal_id;
            resolvedAccount = existing.rows[0].account_id;
            credentialVersion = existing.rows[0].credential_version;
            const profile = await database.query<{ id: string }>(
              `select id from member.profile where principal_id=$1 and status='active' for update`,
              [resolvedPrincipal]
            );
            if (!profile.rows[0]) throw new Error('MEMBER_PROFILE_NOT_FOUND');
            resolvedMember = profile.rows[0].id;
            const current = await database.query<Record<string, unknown>>(
              `select * from access.membership where member_id=$1 and organization_id=$2 and client='storefront'`,
              [resolvedMember, organization]
            );
            if (current.rows[0] && current.rows[0].status !== 'active') reject(403, 'MEMBERSHIP_INACTIVE');
            result = current.rows[0] ?? await accessPort.createRegistration(database, {
              membership,
              member: resolvedMember,
              principal: resolvedPrincipal,
              organization,
              role: registrationTarget.role_id,
              scopeKind,
              scopes: [scopes[0], scopes[1], scopes[2]],
            });
          } else {
            await database.query(`insert into identity.principal(id,status,created_at,updated_at) values($1,'active',clock_timestamp(),clock_timestamp())`, [principal]);
            await database.query(
              `insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,
                mobile_ciphertext,mobile_token,mobile_masked,phone_verified_at,created_at,updated_at)
              values($1,$2,$3,'active',1,$4,$5,$6,$7,$8,clock_timestamp(),clock_timestamp())`,
              [account, realm.realmId, principal, deferredPhoneVerification ? 1 : 2, mobile.ciphertext, mobile.fingerprint,
                `${subject.slice(0, 3)}****${subject.slice(-4)}`, deferredPhoneVerification ? null : new Date()]
            );
            await database.query(
              `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
            values($1,$2,'password',$3,$4,'active',clock_timestamp(),$5,$6)`,
              [credential, principal, subjectHash, password, realm.realmId, account]
            );
            await memberPort.create(database, {
              member,
              principal,
              display: textField(body, 'displayName'),
              status: 'active',
              mobileCiphertext: mobile.ciphertext,
              mobileFingerprint: subjectHash,
              mobileMasked: `${subject.slice(0, 3)}****${subject.slice(-4)}`,
            });
            if (!deferredPhoneVerification) {
              await database.query(
                `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
                values($1,$2,'phone_otp',2,$3,clock_timestamp(),clock_timestamp()+interval '365 days',$4,$5)`,
                [assurance, principal, subjectHash, realm.realmId, account]
              );
            }
            result = registrationTarget.target_client === 'operator'
              ? await accessPort.createOperatorRegistration(database, {
                  storefrontMembership: membership,
                  operatorMembership,
                  governanceParentMembership: registrationTarget.created_by,
                  member,
                  principal,
                  operatorOrganization: organization,
                  storefrontOrganization: registrationTarget.storefront_organization_id!,
                  operatorRole: registrationTarget.role_id,
                  storefrontRole: 'role-zhudatuan-storefront-member',
                  storefrontScopes: [scopes[0], scopes[1], scopes[2]],
                  operatorScopes: [scopes[3], scopes[4]],
                })
              : await accessPort.createRegistration(database, {
                  membership,
                  member,
                  principal,
                  organization,
                  role: registrationTarget.role_id,
                  scopeKind,
                  scopes: [scopes[0], scopes[1], scopes[2]],
                });
          }
          const registeredMembership = String(result.id);
          const realmMemberships = registrationTarget.target_client === 'operator'
            ? [registeredMembership, operatorMembership]
            : [registeredMembership];
          const boundMemberships = await database.query<{ id: string }>(`update access.membership membership
            set realm_id=realm.id,account_id=$3,node_profile=realm.node_profile
            from identity.realm realm
            where membership.id=any($1::text[]) and realm.id=$2 and realm.status='active'
            returning membership.id`,
            [realmMemberships, realm.realmId, resolvedAccount]);
          if (boundMemberships.rows.length !== realmMemberships.length) throw new Error('MEMBERSHIP_REALM_BINDING_FAILED');
          if (typeof body.wechatToken === 'string') {
            await bindWechat(database, tokenHash(body.wechatToken), resolvedPrincipal, registeredMembership, realm.realmId, resolvedAccount);
          }
          await publishIdentityEvent(database, 'identity.member.registered', resolvedPrincipal, organization, request.input.idempotency!, {
            principal: resolvedPrincipal,
            account: resolvedAccount,
            realm: realm.realmId,
            member: resolvedMember,
            membership: registeredMembership,
            ...(registrationTarget.target_client === 'operator' ? { operatorMembership } : {}),
            ...(registrationTarget.governance_level === null ? {} : { governanceLevel: registrationTarget.governance_level }),
          });
          const responseBody = {
            ...result,
            ...(registrationTarget.governance_level === null ? {} : { governanceLevel: registrationTarget.governance_level }),
          };
          if (authorization === null) return { status: 201, body: responseBody };
          const session = `session:${randomUUID()}`;
          const token = randomBytes(48).toString('base64url');
          const csrf = randomBytes(32).toString('base64url');
          const accessVersion = Number(result.access_version);
          if (!Number.isSafeInteger(accessVersion) || accessVersion < 1 || result.client !== 'storefront') throw new Error('MEMBERSHIP_INACTIVE');
          const sessionAssurance = deferredPhoneVerification ? 1 : 2;
          await database.query(
            `insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,device_label,
              assurance_level,realm_id,account_id,auth_target,expires_at,last_seen_at,created_at)
            values($1,$2,$3,$4,$5,$6,'storefront',$7,$8,$9,$10,$11,$12,$13,clock_timestamp()+interval '12 hours',clock_timestamp(),clock_timestamp())`,
            [session, resolvedPrincipal, registeredMembership, tokenHash(token), credentialVersion, accessVersion,
              digest(request.input.headers['x-peer-address'] ?? 'unknown'), String(request.input.headers['user-agent'] ?? 'unknown').slice(0, 512),
              String(request.input.headers['x-device-id'] ?? 'browser').slice(0, 128), sessionAssurance,
              realm.realmId, resolvedAccount, applicationReturnTarget ?? requestedReturnTarget!]
          );
          if (!deferredPhoneVerification) {
            await database.query(
              `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
              values($1,$2,$3,'phone_otp',2,$4,clock_timestamp(),clock_timestamp()+interval '12 hours',$5,$6)`,
              [`assurance:${randomUUID()}`, resolvedPrincipal, session, createHash('sha256').update(textField(body, 'challenge')).digest('hex'), realm.realmId, resolvedAccount]
            );
          }
          await publishIdentityEvent(database, 'identity.session.created', session, registeredMembership, request.input.idempotency!, {
            principal: resolvedPrincipal,
            account: resolvedAccount,
            realm: realm.realmId,
            membership: registeredMembership,
            assurance: sessionAssurance,
            loginMethod: deferredPhoneVerification ? 'registration_password' : 'registration_otp',
          });
          const callback = await tickets.issue(database, session, realm.realmId, resolvedAccount,
            applicationReturnTarget ?? requestedReturnTarget!, authorization);
          return {
            status: 201,
            body: { ...responseBody, authentication: { session, csrf, expiresIn: 43_200, membership: registeredMembership, target: 'storefront', callback } },
            headers: sessionCookies(token, csrf, 43_200),
          };
        },
      }),
      'identity.members.manage': async (request, database) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const action = body.action === 'update' || body.action === 'status' ? body.action : 'create';
        const membershipId = request.input.path.membershipid!;
        const reason = textField(body, 'reason', 1000);
        if (reason.trim().length < 4) throw new Error('CHANGE_REASON_REQUIRED');
        if (action === 'create') {
          const actorAccount = await currentRealmAccount(database, access.membership.id, access.actor.id);
          const username = textField(body, 'username', 128).trim();
          const password = await passwords.hash(secretField(body, 'password', 128));
          const principal = `principal:${randomUUID()}`;
          const account = `account:${randomUUID()}`;
          const member = `member:${randomUUID()}`;
          const membership = membershipId === 'new' ? `membership:${randomUUID()}` : membershipId;
          const credential = `credential:${randomUUID()}`;
          const role = await database.query<{ id: string }>(
            `select id from access.role where scope_id=$1 and status='active'
          and id='role-employee' limit 1`,
            [access.scope.id]
          );
          if (!role.rows[0]) throw new Error('EMPLOYEE_ROLE_NOT_FOUND');
          const exists = await database.query('select 1 from identity.credential where realm_id=$1 and provider=$2 and subject_hash=$3',
            [actorAccount.realmId, 'password', digest(username)]);
          if (exists.rows[0]) throw new Error('IDENTITY_SUBJECT_EXISTS');
          await database.query(`insert into identity.principal(id,status,created_at,updated_at) values($1,'active',clock_timestamp(),clock_timestamp())`, [principal]);
          await database.query(`insert into identity.account(id,realm_id,legacy_principal_id,status,created_at,updated_at)
            values($1,$2,$3,'active',clock_timestamp(),clock_timestamp())`, [account, actorAccount.realmId, principal]);
          await database.query(
            `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
          values($1,$2,'password',$3,$4,'active',clock_timestamp(),$5,$6)`,
            [credential, principal, digest(username), password, actorAccount.realmId, account]
          );
          await memberPort.create(database, { member, principal, display: textField(body, 'displayName', 128), status: 'active' });
          const scopeKind = await organizationPort.kind(database, access.scope.id);
          const result = await accessPort.createRegistration(database, {
            membership,
            member,
            principal,
            organization: access.scope.id,
            role: role.rows[0].id,
            scopeKind,
            scopes: [`scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`],
          });
          const boundMembership = await database.query<{ id: string }>(`update access.membership membership
            set employee_no=$2,realm_id=realm.id,account_id=$4,node_profile=realm.node_profile
            from identity.realm realm where membership.id=$1 and realm.id=$3 and realm.status='active'
            returning membership.id`,
            [membership, typeof body.employeeNo === 'string' ? body.employeeNo.trim() || null : null, actorAccount.realmId, account]);
          if (!boundMembership.rows[0]) throw new Error('MEMBERSHIP_REALM_BINDING_FAILED');
          return { status: 201, body: { ...result, membershipId: membership, memberId: member, userId: principal } };
        }
        const target = await database.query<{
          member_id: string;
          governance_level: 'owner' | 'senior_administrator' | 'administrator' | 'member';
        }>(
          `select membership.member_id,target_governance.governance_level
          from access.membership membership
          join member.profile profile on profile.id=membership.member_id
          cross join lateral access.resolve_governance(
            membership.id,profile.principal_id,$2,$3) target_governance
          where membership.id=$1 and access.scope_allowed(membership.organization_id)
          for update of membership`,
          [membershipId, access.scope.kind, access.scope.id]
        );
        if (!target.rows[0]) throw new Error('MEMBERSHIP_NOT_FOUND');
        if (!requireGovernanceContext(access).isExactOwner
          && (target.rows[0].governance_level === 'owner' || target.rows[0].governance_level === 'senior_administrator')) {
          reject(403, 'PERMISSION_DENIED');
        }
        if (action === 'status') {
          const status = body.status === 'offboarded' ? 'left' : body.status;
          if (!['active', 'suspended', 'left'].includes(String(status))) throw new Error('MEMBERSHIP_STATUS_INVALID');
          const result = await database.query(
            `update access.membership set status=$2,access_version=access_version+1,
          left_at=case when $2='left' then clock_timestamp() else null end where id=$1 returning *`,
            [membershipId, status]
          );
          await accessPort.revokeSessions(database, membershipId);
          return rowResult(result);
        }
        const displayName = textField(body, 'displayName', 128);
        const result = await database.query(
          `update member.profile set display_name=$2,version=version+1,updated_at=clock_timestamp()
        where id=$1 returning *`,
          [target.rows[0].member_id, displayName]
        );
        if (typeof body.departmentId === 'string' && body.departmentId.length > 0) {
          await database.query(`delete from access.scopegrant where membership_id=$1 and scope_kind='department'`, [membershipId]);
          await database.query(
            `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
          values($1,$2,'department',$3,$4,'allow',clock_timestamp(),(select access_version+1 from access.membership where id=$2))`,
            [`scope:${randomUUID()}`, membershipId, body.departmentId, `${access.scope.id}/${body.departmentId}`]
          );
        }
        await accessPort.revokeSessions(database, membershipId);
        return rowResult(result);
      },
      'identity.members.reset': async (request, database) => {
        const access = requireAccess(request);
        const governance = requireGovernanceContext(access);
        const reason = textField(bodyRecord(request), 'reason', 500).trim();
        if (reason.length < 4) reject(422, 'CHANGE_REASON_REQUIRED');
        const expectedVersion = request.input.expectedVersion;
        if (expectedVersion === undefined) reject(400, 'EXPECTED_VERSION_REQUIRED');

        if (!governance.isExactOwner) reject(403, 'PERMISSION_DENIED');

        const actorAccount = await currentRealmAccount(database, access.membership.id, access.actor.id);
        const target = await database.query<{
          member_id: string; account_id: string; realm_id: string; principal_id: string;
          account_status: string; account_version: number; organization_id: string;
        }>(`select membership.member_id,account.id account_id,account.realm_id,
          account.legacy_principal_id principal_id,account.status account_status,
          account.version account_version,membership.organization_id
          from access.membership membership
          join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
          where membership.id=$1 and access.scope_allowed(membership.organization_id)
          for update of membership,account`, [request.input.path.membershipid!]);
        const selected = target.rows[0];
        if (!selected) reject(404, 'MEMBERSHIP_NOT_FOUND');
        if (selected.account_id === actorAccount.accountId) reject(409, 'OWNER_MEMBERSHIP_PROTECTED');
        if (Number(selected.account_version) !== expectedVersion) reject(409, 'VERSION_CONFLICT');

        const protectedOwner = await database.query(`select 1 from access.membership owner_membership
          where owner_membership.id=$1 and owner_membership.member_id=$2 and owner_membership.status='active'`,
        [governance.ownerMembershipId ?? null, selected.member_id]);
        if (protectedOwner.rows[0]) reject(409, 'OWNER_MEMBERSHIP_PROTECTED');

        const memberships = await database.query<{ id: string; organization_id: string }>(
          `select id,organization_id from access.membership where account_id=$1 and realm_id=$2 for update`,
          [selected.account_id, selected.realm_id]
        );
        if (memberships.rows.length === 0) reject(404, 'MEMBERSHIP_NOT_FOUND');
        const outsideScope = await database.query(`select 1 from access.membership
          where account_id=$1 and realm_id=$2 and not access.scope_allowed(organization_id) limit 1`,
        [selected.account_id, selected.realm_id]);
        if (outsideScope.rows[0]) reject(409, 'IDENTITY_RESET_SCOPE_CONFLICT');

        const reauthenticated = await database.query(`select 1 from identity.assurance
          where account_id=$1 and realm_id=$2 and session_id=$3 and method='password' and level>=2
            and verified_at>clock_timestamp()-interval '10 minutes'
            and (expires_at is null or expires_at>clock_timestamp()) limit 1`,
        [actorAccount.accountId, actorAccount.realmId, access.actor.session]);
        if (!reauthenticated.rows[0]) reject(403, 'IDENTITY_REAUTH_REQUIRED');

        const credentials = await database.query<{ id: string; provider: string; status: string; subject_hash: string }>(
          `select id,provider,status,subject_hash from identity.credential where account_id=$1 and realm_id=$2 for update`,
          [selected.account_id, selected.realm_id]
        );
        const activePassword = credentials.rows.filter((credential) => credential.provider === 'password' && credential.status === 'active');
        if (selected.account_status !== 'active' || activePassword.length === 0) reject(409, 'IDENTITY_ACCOUNT_ALREADY_RELEASED');
        for (const credential of activePassword) {
          await database.query('select pg_advisory_xact_lock(hashtext($1))', [`${selected.realm_id}:${credential.subject_hash}`]);
        }

        const reset = `reset:${randomUUID()}`;
        const membershipIds = memberships.rows.map(({ id }) => id);
        await database.query(`update identity.authticket set consumed_at=coalesce(consumed_at,clock_timestamp())
          where session_id in(select session.id from identity.session session join access.membership membership
            on membership.id=session.membership_id where membership.account_id=$1 and membership.realm_id=$2)`,
        [selected.account_id, selected.realm_id]);
        await database.query(`update identity.session session set revoked_at=coalesce(session.revoked_at,clock_timestamp()),
          revoked_reason=coalesce(session.revoked_reason,'identity_reset') where exists(select 1 from access.membership membership
            where membership.id=session.membership_id and membership.account_id=$1 and membership.realm_id=$2)`,
        [selected.account_id, selected.realm_id]);
        await database.query(`update identity.assurance set expires_at=case when expires_at is null or expires_at>clock_timestamp()
          then clock_timestamp() else expires_at end where account_id=$1 and realm_id=$2`, [selected.account_id, selected.realm_id]);
        await database.query(`delete from identity.challengesecret secret using identity.challenge challenge
          where secret.challenge_id=challenge.id and challenge.realm_id=$1
            and (challenge.account_id=$2 or challenge.destination_hash::text=any($3::text[]))`,
        [selected.realm_id, selected.account_id, activePassword.map(({ subject_hash }) => subject_hash)]);
        await database.query(`update identity.challenge set consumed_at=coalesce(consumed_at,clock_timestamp())
          where realm_id=$1 and (account_id=$2 or destination_hash::text=any($3::text[]))`,
        [selected.realm_id, selected.account_id, activePassword.map(({ subject_hash }) => subject_hash)]);
        await database.query(`delete from identity.loginattempt where realm_id=$1 and subject_hash::text=any($2::text[])`,
          [selected.realm_id, activePassword.map(({ subject_hash }) => subject_hash)]);

        const federated = await database.query<{ id: string }>(`select id from identity.federatedidentity
          where account_id=$1 and realm_id=$2 for update`, [selected.account_id, selected.realm_id]);
        for (const identity of federated.rows) {
          await database.query(`update identity.federatedidentity set status='revoked',subject_hash=$2,union_hash=null,
            revoked_at=coalesce(revoked_at,clock_timestamp()),updated_at=clock_timestamp() where id=$1`,
          [identity.id, digest(`${reset}:federated:${identity.id}`)]);
        }
        for (const credential of credentials.rows) {
          await database.query(`update identity.credential set status='revoked',subject_hash=$2,subject_ciphertext=null,
            subject_key_version=null,secret_hash=null,encrypted_secret=null,rotated_at=clock_timestamp() where id=$1`,
          [credential.id, digest(`${reset}:credential:${credential.id}`)]);
        }

        await database.query(`update access.membershiprole set expires_at=clock_timestamp()
          where membership_id=any($1::text[]) and (expires_at is null or expires_at>clock_timestamp())`, [membershipIds]);
        await database.query(`update access.scopegrant set expires_at=clock_timestamp()
          where membership_id=any($1::text[]) and (expires_at is null or expires_at>clock_timestamp())`, [membershipIds]);
        await database.query(`update access.membershipoverride set revoked_at=coalesce(revoked_at,clock_timestamp())
          where membership_id=any($1::text[])`, [membershipIds]);
        await database.query(`update member.invite set status='disabled'
          where created_by=any($1::text[]) and status='active'`, [membershipIds]);
        await database.query(`update access.membership set status='left',access_version=access_version+1,
          employee_no=null,left_at=coalesce(left_at,clock_timestamp()) where id=any($1::text[])`, [membershipIds]);
        await database.query(`update member.profile set display_name='已重置成员 · '||right(id,8),mobile_ciphertext=null,
          mobile_token=null,email_ciphertext=null,email_token=null,status='disabled',version=version+1,updated_at=clock_timestamp()
          where id=$1 and not exists(select 1 from identity.account account
            where account.legacy_principal_id=$2 and account.id<>$3 and account.status='active')`,
        [selected.member_id, selected.principal_id, selected.account_id]);
        const result = await database.query<{ version: number }>(`update identity.account set status='disabled',
          mobile_ciphertext=null,mobile_token=null,mobile_masked=null,phone_verified_at=null,
          credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp()
          where id=$1 and realm_id=$2 returning version`, [selected.account_id, selected.realm_id]);
        await database.query(`update identity.principal set status='disabled',credential_version=credential_version+1,
          version=version+1,updated_at=clock_timestamp() where id=$1 and not exists(select 1 from identity.account account
            where account.legacy_principal_id=$1 and account.status='active')`, [selected.principal_id]);
        const version = Number(result.rows[0]?.version);
        if (!Number.isSafeInteger(version)) throw new Error('IDENTITY_RESET_FAILED');
        await publishIdentityEvent(database, 'identity.member.reset', selected.principal_id, selected.organization_id,
          request.input.idempotency!, { principal: selected.principal_id, account: selected.account_id,
            realm: selected.realm_id, memberships: membershipIds, reason });
        return { status: 200, body: { principal_id: selected.principal_id, account_id: selected.account_id,
          status: 'reset', login_identity_released: true, history_retained: true, version } };
      },
      'identity.password.change': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const body = bodyRecord(request);
          const currentPassword = secretField(body, 'currentPassword', 128);
          const hash = await passwords.hash(secretField(body, 'newPassword', 128));
          return { access, currentPassword, hash };
        },
        execute: async (_request, database, { access, currentPassword, hash }) => {
          await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'))");
          const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
          const credential = await database.query<{ id: string; secret_hash: string }>(`select id,secret_hash from identity.credential
            where account_id=$1 and realm_id=$2 and provider='password' and status='active' for update`, [account.accountId, account.realmId]);
          const found = credential.rows[0];
          if (!found || !(await passwords.verify(currentPassword, found.secret_hash))) throw new Error('CREDENTIAL_INVALID');
          const evidenceHash = sessionDigest(access.actor.session);
          await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
            values($1,$2,'password',2,$3,clock_timestamp(),clock_timestamp()+interval '10 minutes',$4,$5)`,
          [`assurance:${randomUUID()}`, access.actor.id, evidenceHash, account.realmId, account.accountId]);
          const ownerRotation = await database.query<{ result: Readonly<Record<string, unknown>> | null }>(
            `select identity.rotate_zhudatuan_owner_password($1,$2,null::text,$3,'credential_changed') result`,
            [access.actor.id, access.actor.session, hash]
          );
          const ownerResult = ownerRotation.rows[0]?.result;
          if (ownerResult) return { status: 200, body: ownerResult, headers: sessionCookies('', '', 0) };
          await database.query('update identity.credential set secret_hash=$2,rotated_at=clock_timestamp() where id=$1', [found.id, hash]);
          const result = await database.query(`update identity.account set credential_version=credential_version+1,
            updated_at=clock_timestamp(),version=version+1 where id=$1 and realm_id=$2 returning credential_version,version`,
          [account.accountId, account.realmId]);
          await database.query(`update identity.session session set revoked_at=clock_timestamp(),revoked_reason='credential_changed'
            where session.id<>$2 and session.revoked_at is null and exists(select 1 from access.membership membership
              where membership.id=session.membership_id and membership.account_id=$1)`, [account.accountId, access.actor.session]);
          return rowResult(result);
        },
      }),
      'identity.password.verify': async (request, database) => {
        const access = requireAccess(request);
        const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
        const password = secretField(bodyRecord(request), 'password', 128);
        const credential = await database.query<{ secret_hash: string | null }>(
          `select secret_hash from identity.credential
        where account_id=$1 and realm_id=$2 and provider='password' and status='active'`,
          [account.accountId, account.realmId]
        );
        if (!(await passwords.verify(password, credential.rows[0]?.secret_hash ?? null))) reject(401, 'CREDENTIAL_INVALID');
        const verifiedAt = new Date().toISOString();
        await database.query(
          `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
        values($1,$2,$3,'password',2,$4,$5::timestamptz,$5::timestamptz+interval '10 minutes',$6,$7)`,
          [`assurance:${randomUUID()}`, access.actor.id, access.actor.session, sessionDigest(access.actor.session), verifiedAt, account.realmId, account.accountId]
        );
        await database.query(
          `update identity.session set assurance_level=greatest(assurance_level,2),last_seen_at=clock_timestamp()
        where id=$1 and principal_id=$2 and account_id=$3 and realm_id=$4 and revoked_at is null`,
          [access.actor.session, access.actor.id, account.accountId, account.realmId]
        );
        return { status: 200, body: { verified: true, verifiedAt } };
      },
      'identity.password.reset': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const challenge = textField(body, 'challenge');
          const hash = await passwords.hash(secretField(body, 'newPassword', 128));
          return { body, challenge, hash };
        },
        execute: async (request, database, { body, challenge, hash }) => {
          const realm = await resolveRealmNode(database, request.input.headers.host);
          const consumed = await consumeChallenge(database, challenge, textField(body, 'code'), codeDigest, undefined,
            { purpose: 'password_reset', realmId: realm.realmId });
          const principal = consumed.principal_id;
          const account = consumed.account_id;
          if (!principal || !account || consumed.realm_id !== realm.realmId) reject(400, 'CHALLENGE_PRINCIPAL_MISSING');
          const ownerRotation = await database.query<{ result: Readonly<Record<string, unknown>> | null }>(
            `select identity.rotate_zhudatuan_owner_password($1,null::text,$2,$3,'credential_reset') result`,
            [principal, challenge, hash]
          );
          const ownerResult = ownerRotation.rows[0]?.result;
          if (ownerResult) return { status: 200, body: ownerResult, headers: sessionCookies('', '', 0) };
          await database.query("update identity.credential set secret_hash=$3,rotated_at=clock_timestamp() where account_id=$1 and realm_id=$2 and provider='password' and status='active'", [account, realm.realmId, hash]);
          const result = await database.query(`update identity.account set credential_version=credential_version+1,
            updated_at=clock_timestamp(),version=version+1 where id=$1 and realm_id=$2 returning credential_version,version`, [account, realm.realmId]);
          await database.query(`update identity.session session set revoked_at=clock_timestamp(),revoked_reason='credential_reset'
            where session.revoked_at is null and exists(select 1 from access.membership membership
              where membership.id=session.membership_id and membership.account_id=$1 and membership.realm_id=$2)`, [account, realm.realmId]);
          return rowResult(result);
        },
      }),
      'identity.mobile.challenge': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const body = bodyRecord(request);
          const id = `challenge:${randomUUID()}`;
          const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
          const mobile = canonicalMobile(textField(body, 'destination', 32));
          const destinationHash = digest(mobile);
          const [envelope, recipient] = await Promise.all([
            kms.encrypt('identity/challenge', code, { challenge: id, purpose: 'phone_change' }),
            kms.encrypt('identity/destination', mobile, { challenge: id, purpose: 'phone_change' }),
          ]);
          return { access, id, code, destinationHash, envelope, recipient };
        },
        execute: async (request, database, prepared) => {
          const { access, id, code, destinationHash, envelope, recipient } = prepared;
          const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
          const result = await database.query(
            `with challenge as (
          insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,session_hash,attempts,expires_at,created_at,realm_id,account_id)
          values($1,$2,'phone_change',$3,$4,$5,0,clock_timestamp()+interval '10 minutes',clock_timestamp(),$10,$11) returning id,purpose,expires_at
        ), secret as (insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,destination_key_version,created_at)
          values($1,$6,$7,$8,$9,clock_timestamp())) select * from challenge`,
            [id, access.actor.id, destinationHash, codeDigest(id, code), sessionDigest(access.actor.session),
              envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion, account.realmId, account.accountId]
          );
          await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'identitynotification','identity',$2,jsonb_build_object('challenge',$3::text),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
          [`job:notify:${id}`, access.scope.id, id]);
          await publishIdentityEvent(database, 'identity.challenge.started', id, access.scope.id, request.input.idempotency!,
            { challenge: id, destination: destinationHash, purpose: 'phone_change' });
          return rowResult(result, 202);
        },
      }),
      'identity.mobile.manage': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const body = bodyRecord(request);
          const mobile = canonicalMobile(textField(body, 'mobile', 32));
          const envelope = await kms.encrypt('identity/mobile', mobile, { principal: access.actor.id });
          return { access, body, mobile, envelope };
        },
        execute: async (_request, database, { access, body, mobile, envelope }) => {
          const governance = requireGovernanceContext(access);
          await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'))");
          const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
          const destinationHash = digest(mobile);
          await database.query('select pg_advisory_xact_lock(hashtext($1))', [`${account.realmId}:${destinationHash}`]);
          const accountState = await database.query<{ mobile_ciphertext: string | null }>(
            `select mobile_ciphertext from identity.account where id=$1 and realm_id=$2 and status='active' for update`,
            [account.accountId, account.realmId]);
          const current = accountState.rows[0];
          if (!current) reject(404, 'RESOURCE_NOT_FOUND');
          if (current.mobile_ciphertext === null) {
            const passwordEvidence = await database.query(`select 1 from identity.assurance where account_id=$1 and realm_id=$2 and method='password' and level=2
              and evidence_hash=$3 and verified_at>=clock_timestamp()-interval '10 minutes'
              and expires_at>clock_timestamp() limit 1`, [account.accountId, account.realmId, sessionDigest(access.actor.session)]);
            if (!passwordEvidence.rows[0]) reject(403, 'MOBILE_ENROLLMENT_PASSWORD_REQUIRED');
          } else if (!stepup.accepts(true, access.assurance, new Date())) reject(403, 'MOBILE_CHANGE_STEP_UP_REQUIRED');
          const boundAccount = await resolveBoundMobileAccount(database, account.realmId,
            [destinationHash, envelope.fingerprint, createHash('sha256').update(mobile).digest('hex')]);
          if (boundAccount !== null && boundAccount.account_id !== account.accountId) reject(409, 'IDENTITY_SUBJECT_EXISTS');
          await consumeChallenge(database, textField(body, 'challenge'), textField(body, 'code'), codeDigest, access.actor.id,
            { purpose: 'phone_change', destinationHash, sessionHash: sessionDigest(access.actor.session),
              realmId: account.realmId, accountId: account.accountId });
          if (governance.isExactOwner) {
            const changed = await database.query<{ profile: Readonly<Record<string, unknown>> }>(
              `select access.change_zhudatuan_owner_mobile($1,$2,$3,$4,$5,$6,$7,$8,$9) profile`,
              [access.actor.id, access.actor.session, textField(body, 'challenge'), envelope.ciphertext,
                destinationHash, envelope.fingerprint, maskMobile(mobile), sessionDigest(access.actor.session), sessionDigest(access.actor.session)]);
            const result = changed.rows[0]?.profile;
            if (!result) throw new Error('MEMBER_PROFILE_NOT_FOUND');
            return { status: 200, body: result, headers: { ...sessionCookies('', '', 0), etag: `\"${String(result.version)}\"` } };
          }
          const credential = await database.query<{ id: string }>(`select id from identity.credential
            where account_id=$1 and realm_id=$2 and provider='password' and status='active' for update`, [account.accountId, account.realmId]);
          if (!credential.rows[0]) throw new Error('CREDENTIAL_NOT_FOUND');
          const result = await memberPort.changeMobile(database, access.actor.id, envelope.ciphertext, envelope.fingerprint, maskMobile(mobile));
          await database.query(`update identity.assurance set expires_at=least(coalesce(expires_at,clock_timestamp()),clock_timestamp())
            where account_id=$1 and realm_id=$2 and method='phone_otp' and (expires_at is null or expires_at>clock_timestamp())`,
          [account.accountId, account.realmId]);
          await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
            values($1,$2,'phone_otp',2,$3,clock_timestamp(),clock_timestamp()+interval '365 days',$4,$5)`,
          [`assurance:${randomUUID()}`, access.actor.id, digest(mobile), account.realmId, account.accountId]);
          await database.query(`update identity.account set mobile_ciphertext=$3,mobile_token=$4,mobile_masked=$5,
            phone_verified_at=clock_timestamp(),credential_version=credential_version+1,assurance_level=greatest(assurance_level,2),
            version=version+1,updated_at=clock_timestamp() where id=$1 and realm_id=$2`,
          [account.accountId, account.realmId, envelope.ciphertext, envelope.fingerprint, maskMobile(mobile)]);
          await database.query(`update identity.session session set revoked_at=clock_timestamp(),revoked_reason='mobile_changed'
            where session.revoked_at is null and exists(select 1 from access.membership membership
              where membership.id=session.membership_id and membership.account_id=$1 and membership.realm_id=$2)`,
          [account.accountId, account.realmId]);
          return { status: 200, body: result, headers: { ...sessionCookies('', '', 0), etag: `\"${String(result.version)}\"` } };
        },
      }),
      'identity.stepup.start': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const id = `challenge:${randomUUID()}`;
          const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
          if (Object.hasOwn(bodyRecord(request), 'destination')) reject(400, 'STEP_UP_DESTINATION_FORBIDDEN');
          return { access, id, code };
        },
        execute: async (request, database, { access, id, code }) => {
          const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
          const accountState = await database.query<{ mobile_ciphertext: string | null }>(
            `select mobile_ciphertext from identity.account where id=$1 and realm_id=$2 and status='active'`, [account.accountId, account.realmId]);
          const ciphertext = accountState.rows[0]?.mobile_ciphertext;
          if (!ciphertext) throw new Error('STEP_UP_DESTINATION_MISSING');
          const destination = await kms.decrypt('identity/mobile', ciphertext, { principal: access.actor.id });
          const [envelope, recipient] = await Promise.all([kms.encrypt('identity/challenge', code, { challenge: id, purpose: 'stepup' }), kms.encrypt('identity/destination', destination, { challenge: id, purpose: 'stepup' })]);
          const result = await database.query(
            `with challenge as (insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,session_hash,attempts,expires_at,created_at,realm_id,account_id)
        values($1,$2,'stepup',$3,$4,$5,0,clock_timestamp()+interval '5 minutes',clock_timestamp(),$10,$11) returning id,purpose,expires_at),
        secret as (insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,destination_key_version,created_at)
          values($1,$6,$7,$8,$9,clock_timestamp())) select * from challenge`,
            [id, access.actor.id, digest(destination), codeDigest(id, code), sessionDigest(access.actor.session),
              envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion, account.realmId, account.accountId]
          );
          await database.query(
            `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'identitynotification','identity',$2,jsonb_build_object('challenge',$3::text),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
            [`job:notify:${id}`, access.scope.id, id]
          );
          await publishIdentityEvent(database, 'identity.challenge.started', id, access.scope.id, request.input.idempotency!, { challenge: id, purpose: 'stepup' });
          return rowResult(result, 202);
        },
      }),
      'identity.stepup.complete': async (request, database) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const account = await currentRealmAccount(database, access.membership.id, access.actor.id);
        const action = financialActionRequest(body.action);
        const bindingToken = body.bindingToken === undefined ? null : textField(body, 'bindingToken', 1024);
        if (action !== null && bindingToken !== null) reject(400, 'OPERATION_INPUT_INVALID');
        const wechatBinding = bindingToken === null ? null
          : await prepareWechatBinding(database, tokenHash(bindingToken), access.actor.id, account.realmId, account.accountId);
        const challenge = textField(body, 'challenge');
        const accountState = await database.query<{ mobile_ciphertext: string | null }>(
          `select mobile_ciphertext from identity.account where id=$1 and realm_id=$2 and status='active' for update`, [account.accountId, account.realmId]);
        const ciphertext = accountState.rows[0]?.mobile_ciphertext;
        if (!ciphertext) throw new Error('STEP_UP_DESTINATION_MISSING');
        const destination = await kms.decrypt('identity/mobile', ciphertext, { principal: access.actor.id });
        await consumeChallenge(database, challenge, textField(body, 'code'), codeDigest, access.actor.id,
          { purpose: 'stepup', destinationHash: digest(destination), sessionHash: sessionDigest(access.actor.session),
            realmId: account.realmId, accountId: account.accountId });
        await database.query(
          `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
          values($1,$2,'phone_otp',2,$3,clock_timestamp(),clock_timestamp()+interval '365 days',$4,$5)`,
          [`assurance:${randomUUID()}`, access.actor.id, digest(destination), account.realmId, account.accountId]
        );
        const assurance = `assurance:${randomUUID()}`;
        if (action === null) {
          await database.query(
            `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
          values($1,$2,$3,'otp',3,$4,clock_timestamp(),clock_timestamp()+interval '15 minutes',$5,$6)`,
            [assurance, access.actor.id, access.actor.session, sessionDigest(access.actor.session), account.realmId, account.accountId]
          );
        } else {
          await database.query(
            `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
          values($1,$2,$3,'otp',3,$4,clock_timestamp(),clock_timestamp()+interval '15 minutes',$5,$6)`,
            [assurance, access.actor.id, access.actor.session, digest(challenge), account.realmId, account.accountId]
          );
        }
        const result = await database.query(
          `update identity.session set assurance_level=3,last_seen_at=clock_timestamp()
        where id=$1 and principal_id=$2 and account_id=$3 and realm_id=$4 and revoked_at is null returning id,assurance_level`,
          [access.actor.session, access.actor.id, account.accountId, account.realmId]
        );
        const session = result.rows[0];
        if (!session) throw new Error('AUTHENTICATION_REQUIRED');
        if (wechatBinding !== null) {
          const identity = await completeWechatBinding(database, wechatBinding, access.actor.id, access.membership.id, account.realmId, account.accountId);
          return { status: 200, body: { ...session, wechat: { identity, status: 'active' } } };
        }
        if (action === null) return rowResult(result);
        const proof = randomBytes(48).toString('base64url');
        const issued = await database.query<{ scope_id: string; resource_id: string; expires_at: Date }>('select scope_id,resource_id,expires_at from access.issue_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
          createHash('sha256').update(proof).digest('hex'),
          access.actor.id,
          access.actor.session,
          access.membership.id,
          assurance,
          action.operation,
          action.resource,
          action.idempotencyKey,
          action.expectedVersion,
          action.requestHash,
        ]);
        const binding = issued.rows[0];
        if (!binding) throw new Error('ACTION_PROOF_REQUIRED');
        return {
          status: 200,
          body: {
            ...session,
            actionProof: {
              proof,
              operation: action.operation,
              resource: binding.resource_id,
              scope: binding.scope_id,
              idempotencyKey: action.idempotencyKey,
              expectedVersion: action.expectedVersion,
              requestHash: action.requestHash,
              expiresAt: binding.expires_at.toISOString(),
            },
          },
        };
      },
    };
  const selected = Object.fromEntries(ownedOperations.map((operationId) => {
    const action = actions[operationId];
    if (!action) throw new Error(`IDENTITY_OPERATION_NOT_AVAILABLE:${operationId}`);
    return [operationId, action];
  })) as OperationActions;
  return new ModuleOperations('identity', pool, audit, selected, ownedOperations);
}

function requireInvitationManager(request: OperationRequest) {
  const access = requireAccess(request);
  const permission = access.membership.grants.some((grant) => grant.permissions.includes('identity.invitation.manage'));
  if (access.actor.target !== 'console' || !access.capabilities.includes(request.type) || !permission) reject(403, 'PERMISSION_DENIED');
  const governance = requireGovernanceContext(access);
  const invitationAuthority = governance.isExactOwner || governance.governanceLevel === 'senior_administrator';
  if (!invitationAuthority) reject(403, 'PERMISSION_DENIED');
  return { access, invitationAuthority };
}

function invitationGovernanceLevel(value: unknown, targetClient: 'storefront' | 'operator'):
  'administrator' | 'senior_administrator' | null {
  if (targetClient !== 'operator') {
    if (value !== undefined) throw new Error('INVALID_INVITATION_INPUT');
    return null;
  }
  if (value === undefined || value === 'administrator') return 'administrator';
  if (value === 'senior_administrator') return value;
  throw new Error('INVALID_INVITATION_INPUT');
}

function seniorAdministratorRoleId(organization: string): string {
  return `role-senior-administrator-v1:${organization}`;
}

async function requireValidInvite<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'INVITE_INVALID') reject(400, 'INVITE_INVALID');
    throw cause;
  }
}

type RegistrationReference = Readonly<{ kind: 'invite' | 'storefront'; value: string }>;

function registrationReference(body: Readonly<Record<string, unknown>>): RegistrationReference {
  const hasInvite = typeof body.invite === 'string' && body.invite.trim().length > 0;
  const hasStorefront = typeof body.application === 'string' && body.application.trim().length > 0;
  if (hasInvite === hasStorefront) throw new Error('REGISTRATION_CONTEXT_INVALID');
  if (hasInvite) return Object.freeze({ kind: 'invite', value: textField(body, 'invite') });
  return Object.freeze({ kind: 'storefront', value: storefrontSlug(body) });
}

function storefrontSlug(body: Readonly<Record<string, unknown>>): string {
  const value = textField(body, 'application', 48).trim();
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(value)) throw new Error('STOREFRONT_NOT_FOUND');
  return value;
}

async function requireValidStorefront<T>(operation: Promise<T | undefined>): Promise<T> {
  const storefront = await operation;
  if (storefront === undefined) reject(404, 'STOREFRONT_NOT_FOUND');
  return storefront;
}

function maskMobile(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function maskInvitationMobile(value: string): string {
  return maskMobile(/^\+86(1[3-9][0-9]{9})$/.exec(value)?.[1] ?? value);
}

interface FinancialActionRequest {
  readonly operation: string;
  readonly resource: string | null;
  readonly idempotencyKey: string;
  readonly expectedVersion: number | null;
  readonly requestHash: string;
}

function financialActionRequest(value: unknown): FinancialActionRequest | null {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('ACTION_PROOF_REQUIRED');
  const operation = Reflect.get(value, 'operation');
  const resourceValue = Reflect.get(value, 'resource');
  const idempotencyValue = Reflect.get(value, 'idempotencyKey');
  const expectedValue = Reflect.get(value, 'expectedVersion');
  const requestHashValue = Reflect.get(value, 'requestHash');
  const requestValue = Reflect.get(value, 'request');
  if (typeof operation !== 'string' || !requiresFinancialActionProof(operation)) throw new Error('ACTION_PROOF_REQUIRED');
  if (resourceValue !== undefined && (typeof resourceValue !== 'string' || resourceValue.length === 0 || resourceValue.length > 255)) {
    throw new Error('ACTION_PROOF_REQUIRED');
  }
  if (typeof idempotencyValue !== 'string' || idempotencyValue.length === 0 || idempotencyValue.length > 255) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }
  if (expectedValue !== undefined && (!Number.isSafeInteger(expectedValue) || (expectedValue as number) < 0)) {
    throw new Error('EXPECTED_VERSION_INVALID');
  }
  if (requiresFinancialExpectedVersion(operation) && expectedValue === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  if (typeof requestHashValue !== 'string' || !/^[0-9a-f]{64}$/.test(requestHashValue) || requestValue === null || typeof requestValue !== 'object' || Array.isArray(requestValue)) {
    throw new Error('ACTION_PROOF_REQUIRED');
  }
  let authoritativeHash: string;
  try {
    authoritativeHash = createHash('sha256')
      .update(
        canonicalFinancialActionRequest({
          operation,
          path: Reflect.get(requestValue, 'path'),
          query: Reflect.get(requestValue, 'query'),
          body: Reflect.get(requestValue, 'body'),
        })
      )
      .digest('hex');
  } catch {
    throw new Error('ACTION_PROOF_REQUIRED');
  }
  if (requestHashValue !== authoritativeHash) throw new Error('ACTION_PROOF_REQUIRED');
  return {
    operation,
    resource: typeof resourceValue === 'string' ? resourceValue : null,
    idempotencyKey: idempotencyValue,
    expectedVersion: typeof expectedValue === 'number' ? expectedValue : null,
    requestHash: authoritativeHash,
  };
}

function inviteExpiry(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_INVITATION_INPUT');
  const time = new Date(value).getTime();
  const now = Date.now();
  if (!Number.isFinite(time) || time <= now + 10 * 60_000 || time > now + 90 * 24 * 60 * 60_000) throw new Error('INVALID_INVITATION_INPUT');
  return new Date(time).toISOString();
}
