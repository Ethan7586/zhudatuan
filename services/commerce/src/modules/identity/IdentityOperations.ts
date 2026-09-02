import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { canonicalFinancialActionRequest, requiresFinancialActionProof, requiresFinancialExpectedVersion, type OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, pageResult, reject, requireAccess, rowResult, type OperationActions, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../foundation/interface/Validation';
import type { OperationRequest, OperationUsecase } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { StepupPolicy } from '../../foundation/security/StepupPolicy';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { PasswordPolicy } from './domain/policy/PasswordPolicy';
import { bindWechat, publishIdentityEvent, tokenHash } from './IdentityPersistence';
import { AuthTransaction } from './domain/model/AuthTransaction';
import { PgAuthTicket } from './infrastructure/PgAuthTicket';
import { RETURN_TARGETS } from './infrastructure/ReturnTargetCatalog';
import { ReturnTargetSigner } from './infrastructure/ReturnTargetSigner';
import { authTarget, consumeChallenge, requestCookie, sessionCookies } from './IdentitySecurity';
import { accessPort } from '../access/AccessPort';
import { memberPort } from '../member/MemberPort';
import { organizationPort } from '../organization/OrganizationPort';
import { canonicalMobile } from './IdentitySubject';
import { consumeSmsLoginChallenge, recordInvalidSmsLoginChallenge, resolveBoundMobilePrincipal, verifySmsLoginChallenge } from './SmsLogin';

export const IDENTITY_CORE_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.sessions.read',
  'identity.sessions.revoke',
  'identity.challenges.create',
  'identity.invitations.read',
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

export const IDENTITY_REGISTRATION_OPERATION_IDS = Object.freeze([
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.challenges.create',
  'identity.invitations.read',
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

export function identityRegistrationOperations(context: ModuleContext): OperationUsecase {
  return identityCoreOperations(context, IDENTITY_REGISTRATION_OPERATION_IDS, true);
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
          const authorization = AuthTransaction.start(body.authorization);
          const provider = body.provider === undefined ? 'password' : textField(body, 'provider', 32);
          if (provider !== 'password' && provider !== 'phone_otp') throw new Error('CREDENTIAL_PROVIDER_INVALID');
          const normalizedSubject = provider === 'phone_otp' ? canonicalMobile(textField(body, 'subject', 32)) : textField(body, 'subject');
          const subject = digest(normalizedSubject);
          return {
            body,
            provider,
            authorization,
            subject,
          };
        },
        execute: async (request, database, { body, provider, authorization, subject }) => {
          let found: Readonly<{ principal_id: string; credential_version: number }> | undefined;
          let loginChallenge: string | undefined;
          let loginCode: string | undefined;
          if (provider === 'password') {
            const credential = await database.query<{ principal_id: string; secret_hash: string | null; credential_version: number }>(
              `select credential.principal_id,credential.secret_hash,principal.credential_version
            from identity.credential credential join identity.principal principal on principal.id=credential.principal_id
            where credential.provider='password' and credential.subject_hash=$1 and credential.status='active' and principal.status='active' for update`,
              [subject]
            );
            const credentialFound = credential.rows[0];
            if (!(await passwords.verify(textField(body, 'password', 128), credentialFound?.secret_hash ?? null))) {
              reject(401, 'CREDENTIAL_INVALID');
            }
            if (credentialFound) found = credentialFound;
          } else {
            loginChallenge = textField(body, 'challenge', 128);
            loginCode = textField(body, 'code', 16);
            found = await verifySmsLoginChallenge(database, {
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
          const memberships = await database.query<{ id: string; access_version: number; client: string }>(
            `select membership.id,membership.access_version,membership.client from member.profile profile
          join access.membership membership on membership.member_id=profile.id where profile.principal_id=$1 and membership.status='active' order by membership.id`,
            [found.principal_id]
          );
          const requestedTarget = typeof body.target === 'string' ? authTarget(body.target) : undefined;
          const candidates = requestedTarget === undefined ? memberships.rows : memberships.rows.filter((item) => authTarget(item.client) === requestedTarget);
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
              principal: found.principal_id,
              destinationHash: subject,
            });
            if (!consumed) reject(401, 'CREDENTIAL_INVALID');
          }
          const token = randomBytes(48).toString('base64url');
          const id = `session:${randomUUID()}`;
          const assurance = provider === 'phone_otp' ? 2 : 1;
          await database.query(
            `insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp()+interval '12 hours',clock_timestamp(),clock_timestamp())`,
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
            ]
          );
          if (provider === 'phone_otp') {
            await database.query(
              `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
              values($1,$2,$3,'phone_otp',2,$4,clock_timestamp(),clock_timestamp()+interval '12 hours')`,
              [`assurance:${randomUUID()}`, found.principal_id, id, createHash('sha256').update(loginChallenge!).digest('hex')]
            );
          }
          await publishIdentityEvent(database, 'identity.session.created', id, membership.id, request.input.idempotency!, {
            principal: found.principal_id,
            membership: membership.id,
            assurance,
            loginMethod: provider,
          });
          const csrf = randomBytes(32).toString('base64url');
          const target = authTarget(membership.client);
          const callback = await tickets.issue(database, id, target, authorization);
          return { status: 201, body: { session: id, csrf, expiresIn: 43_200, membership: membership.id, target, callback }, headers: sessionCookies(token, csrf, 43_200) };
        },
      }),
      'identity.tickets.exchange': async (request, database) => {
        const currentToken = requestCookie(request.input.headers.cookie, 'shop_session');
        if (!currentToken) reject(401, 'AUTHENTICATION_REQUIRED');
        const token = randomBytes(48).toString('base64url');
        const csrf = randomBytes(32).toString('base64url');
        const exchanged = await tickets.consume(database, request.input.body, currentToken, token);
        const expiresIn = Math.max(1, Math.min(43_200, Math.floor((exchanged.sessionExpiresAt.getTime() - Date.now()) / 1_000)));
        return {
          status: 200,
          body: { returnTarget: exchanged.returnTarget, expiresIn },
          headers: sessionCookies(token, csrf, expiresIn),
        };
      },
      'identity.session.read': async (request, database) => {
        const access = requireAccess(request);
        const permissions = [...new Set(access.membership.grants.flatMap((grant) => grant.permissions).filter((permission) => !access.membership.denies.includes(permission)))].sort();
        const scopes = [...new Map(access.membership.grants.map((grant) => [grant.scope.id, grant.scope] as const)).values()];
        const csrf = requestCookie(request.input.headers.cookie, 'shop_csrf');
        const [credential, member] = await Promise.all([
          database.query<{ rotated_at: Date | null }>(
            `select rotated_at from identity.credential
          where principal_id=$1 and provider='password' and status='active' order by created_at desc limit 1`,
            [access.actor.id]
          ),
          memberPort.securityProfile(database, access.actor.id),
        ]);
        const mobile = member.mobileCiphertext === null ? null : await kms.decrypt('identity/mobile', member.mobileCiphertext, { principal: access.actor.id });
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
            ...(member.displayName === null ? {} : {
              profile: { display_name: member.displayName, employee_no: null },
            }),
            security: { hasLocalCredential: credential.rows.length > 0, phoneMasked: mobile === null ? null : maskMobile(mobile), passwordChangedAt: credential.rows[0]?.rotated_at?.toISOString() ?? null },
            syncedAt: new Date().toISOString(),
            ...(csrf === undefined ? {} : { csrf }),
          },
        };
      },
      'identity.session.delete': async (request, database) => {
        const access = requireAccess(request);
        const result = await database.query(`update identity.session set revoked_at=clock_timestamp(),revoked_reason='logout' where id=$1 and principal_id=$2 and revoked_at is null returning id,revoked_at`, [
          access.actor.session,
          access.actor.id,
        ]);
        const response = rowResult(result);
        await publishIdentityEvent(database, 'identity.session.revoked', access.actor.session, access.membership.id, request.input.idempotency!, { sessions: [access.actor.session], reason: 'logout' });
        return { ...response, headers: sessionCookies('', '', 0) };
      },
      'identity.sessions.read': async (request, database) => {
        const access = requireAccess(request);
        const result = await database.query(
          `select id,membership_id as membership,client,device_label as "deviceLabel",user_agent as "userAgent",
        assurance_level as assurance,created_at as "createdAt",last_seen_at as "lastSeenAt",expires_at as "expiresAt",id=$2 as current
        from identity.session where principal_id=$1 and revoked_at is null and expires_at>clock_timestamp()
        order by (id=$2) desc,last_seen_at desc,id limit 100`,
          [access.actor.id, access.actor.session]
        );
        return pageResult(result);
      },
      'identity.sessions.revoke': async (request, database) => {
        const access = requireAccess(request);
        const session = request.input.path.sessionid;
        if (!session) reject(404, 'RESOURCE_NOT_FOUND');
        const result =
          session === 'others'
            ? await database.query<{ id: string }>(
                `update identity.session set revoked_at=clock_timestamp(),revoked_reason='security_center'
            where principal_id=$1 and id<>$2 and revoked_at is null returning id`,
                [access.actor.id, access.actor.session]
              )
            : await database.query<{ id: string }>(
                `update identity.session set revoked_at=clock_timestamp(),revoked_reason='security_center'
            where principal_id=$1 and id=$2 and revoked_at is null returning id`,
                [access.actor.id, session]
              );
        if (session !== 'others' && result.rowCount === 0) {
          const owned = await database.query<{ revoked_at: Date | null }>('select revoked_at from identity.session where principal_id=$1 and id=$2', [access.actor.id, session]);
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
          if (registrationOnly && purpose !== 'registration' && purpose !== 'password_reset') reject(400, 'CHALLENGE_PURPOSE_INVALID');
          if (!['registration', 'login', 'password_reset', 'wechat_bind'].includes(purpose)) throw new Error('CHALLENGE_PURPOSE_INVALID');
          const requestedDestination = textField(body, 'destination').trim();
          const destination = purpose === 'registration' || purpose === 'login' || purpose === 'password_reset'
            ? canonicalMobile(requestedDestination) : requestedDestination;
          const destinationHash = digest(destination);
          const inviteHash = purpose === 'registration' ? digest(textField(body, 'invite')) : undefined;
          const legacyMobileToken = purpose === 'login' ? createHash('sha256').update(destination).digest('hex') : undefined;
          const [envelope, recipient, mobileLookup] = await Promise.all([
            kms.encrypt('identity/challenge', code, { challenge: id, purpose }),
            kms.encrypt('identity/destination', destination, { challenge: id, purpose }),
            purpose === 'login' ? kms.encrypt('identity/mobile', destination, { challenge: id, purpose }) : Promise.resolve(undefined),
          ]);
          return { body, id, code, purpose, destinationHash, inviteHash, legacyMobileToken, envelope, recipient, mobileLookup };
        },
        execute: async (request, database, prepared) => {
          const { body, id, code, purpose, destinationHash, inviteHash, legacyMobileToken, envelope, recipient, mobileLookup } = prepared;
          if (purpose === 'registration') {
            if (!inviteHash) throw new Error('INVITE_INVALID');
            await requireValidInvite(memberPort.assertRegistrationInvite(database, inviteHash, destinationHash));
          }
          let principal = typeof body.principal === 'string' ? body.principal : null;
          if (purpose === 'login') {
            principal = await resolveBoundMobilePrincipal(database, [destinationHash, mobileLookup!.fingerprint, legacyMobileToken!]);
          } else if (purpose === 'password_reset') {
            const credential = await database.query<{ principal_id: string }>(
              `select principal_id from identity.credential
            where provider='password' and subject_hash=$1 and status='active'`,
              [destinationHash]
            );
            principal = credential.rows[0]?.principal_id ?? null;
          }
          const result = await database.query(
            `with challenge as (
          insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at)
          values($1,$2,$3,$4,$5,0,clock_timestamp()+interval '10 minutes',clock_timestamp()) returning id,purpose,expires_at
        ), secret as (insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,destination_key_version,created_at)
          values($1,$6,$7,$8,$9,clock_timestamp())) select * from challenge`,
            [id, principal, purpose, destinationHash, codeDigest(id, inviteHash === undefined ? code : `${code}:${inviteHash}`), envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion]
          );
          await database.query(
            `insert into runtime.job(id,kind,owner,payload,state,priority,available_at,created_at,updated_at)
          select $1,'identitynotification','identity',jsonb_build_object('challenge',$2::text),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp()
          where $3::text is not null`,
            [`job:notify:${id}`, id, purpose === 'login' ? principal : 'public-challenge']
          );
          await publishIdentityEvent(database, 'identity.challenge.started', id, 'identity', request.input.idempotency!, { challenge: id, destination: destinationHash, purpose });
          return rowResult(result, 202);
        },
      }),
      'identity.invitations.read': async (request, database) => {
        const body = bodyRecord(request);
        const result = await memberPort.invite(database, digest(textField(body, 'invite')));
        return rowResult(result);
      },
      'identity.invitations.create': async (request, database) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const label = textField(body, 'label', 80);
        const requestedTarget = body.targetClient;
        if (requestedTarget !== undefined && requestedTarget !== 'storefront' && requestedTarget !== 'operator') throw new Error('INVALID_INVITATION_INPUT');
        const targetClient = registrationOnly ? 'operator' : requestedTarget ?? 'storefront';
        const invitationScope = access.scope.kind === 'platform' && targetClient === 'operator'
          ? textField(body, 'tenantId') : access.scope.id;
        if (access.scope.kind === 'platform' && targetClient === 'operator') {
          const target = await database.query<{ id: string }>(`select organization.id from organization.organization organization
          where organization.id=$1 and organization.kind='tenant' and organization.status='active'
            and access.scope_allowed(organization.id)`, [invitationScope]);
          if (target.rows[0]?.id !== invitationScope) reject(403, 'PERMISSION_DENIED');
          await database.query(`select set_config('app.scope_id',$1,true)`, [invitationScope]);
        }
        const { exactOwner } = await requireInvitationManager(request, database, registrationOnly);
        if (registrationOnly && requestedTarget !== undefined && requestedTarget !== 'operator') throw new Error('INVALID_INVITATION_INPUT');
        if (targetClient === 'operator' && !exactOwner) reject(403, 'PERMISSION_DENIED');
        const maxUses = integerField(body, 'maxUses', 1);
        const expiresAt = inviteExpiry(body.expiresAt);
        if (label.length < 2 || maxUses > 500 || (targetClient === 'operator' && maxUses !== 1)) throw new Error('INVALID_INVITATION_INPUT');
        if (targetClient === 'operator' && access.scope.kind !== 'platform'
          && (access.scope.kind !== 'tenant' || access.scope.id !== access.scope.tenant)) throw new Error('INVITATION_SCOPE_INVALID');
        if (targetClient === 'storefront' && access.scope.kind !== 'mall') throw new Error('INVITATION_SCOPE_INVALID');
        const destinationHash = targetClient === 'operator' ? digest(canonicalMobile(textField(body, 'destination', 32))) : null;
        const requestedStorefront = typeof body.storefrontOrganization === 'string' && body.storefrontOrganization.trim().length > 0
          ? body.storefrontOrganization.trim() : null;
        const storefronts = targetClient === 'operator'
          ? await database.query<{ id: string }>(`select storefront.id from organization.organization storefront
            join organization.unitclosure closure on closure.descendant_id=storefront.id
            where closure.ancestor_id=$1 and storefront.kind='mall' and storefront.status='active'
              and ($2::text is null or storefront.id=$2) order by storefront.id limit 2`, [invitationScope, requestedStorefront])
          : { rows: [] };
        if (targetClient === 'operator' && storefronts.rows.length !== 1) throw new Error('STOREFRONT_SCOPE_REQUIRED');
        const roleId = targetClient === 'operator' ? 'role-zhudatuan-pending-operator' : 'role-zhudatuan-storefront-member';
        const role = await database.query<{ id: string }>(`select role.id from access.role role where role.id=$1
        and role.status='active' and role.scope_id=$2
        and ($1<>'role-zhudatuan-pending-operator' or not exists(
          select 1 from access.rolepermission pendingpermission where pendingpermission.role_id=role.id))`, [roleId, invitationScope]);
        if (role.rows[0]?.id !== roleId) throw new Error('EMPLOYEE_ROLE_NOT_FOUND');
        const policy = await database.query<{ id: string; terms_hash: string }>(`select id,terms_hash from identity.registrationpolicy
        where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp()) order by version desc limit 1`);
        if (!policy.rows[0]) throw new Error('INVITE_INVALID');
        const id = `invite:${randomUUID()}`;
        const code = randomBytes(24).toString('base64url');
        const result = await database.query(
          `insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
        role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,registration_policy_id,terms_hash,version,
        target_client,storefront_organization_id)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,clock_timestamp(),'active',clock_timestamp(),$11,$12,0,$13,$14)
        returning id,label,case target_client when 'operator' then 'console' else target_client end target,
          max_uses,use_count,effective_at starts_at,expires_at,status,created_at,version`,
          [id, invitationScope, label, destinationHash ?? digest(id), digest(code), expiresAt, access.membership.id,
            role.rows[0].id, destinationHash, maxUses, policy.rows[0].id, policy.rows[0].terms_hash,
            targetClient, storefronts.rows[0]?.id ?? null]
        );
        const saved = result.rows[0];
        if (!saved) throw new Error('INVITE_INVALID');
        return { status: 201, body: { ...saved, code }, headers: { etag: '"0"' } };
      },
      'identity.invitations.revoke': async (request, database) => {
        const { exactOwner } = await requireInvitationManager(request, database, registrationOnly);
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
          [id, request.input.expectedVersion ?? null, registrationOnly, exactOwner]
        );
        if (result.rows[0]) return rowResult(result);
        const current = await database.query<{ status: string; version: number }>(
          `select status,version from member.invite
        where id=$1 and access.scope_allowed(organization_id)
          and (not $2::boolean or (target_client='operator' and organization_id='tenant-zhudatuan'))
          and (target_client<>'operator' or $3::boolean)`,
          [id, registrationOnly, exactOwner]
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
            passwords.hash(textField(body, 'password', 128)),
            kms.encrypt('identity/mobile', subject, { principal }),
          ]);
          return {
            body,
            subject,
            password,
            principal,
            mobile,
            assurance: `assurance:${randomUUID()}`,
            member: `member:${randomUUID()}`,
            membership: `membership:${randomUUID()}`,
            operatorMembership: `membership:${randomUUID()}`,
            credential: `credential:${randomUUID()}`,
            scopes: [`scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`] as const,
          };
        },
        execute: async (request, database, prepared) => {
          const { body, subject, password, principal, mobile, assurance, member, membership, operatorMembership, credential, scopes } = prepared;
          const subjectHash = digest(subject);
          await database.query('select pg_advisory_xact_lock(hashtext($1))', [subjectHash]);
          const existing = await database.query(
            `select 1 from identity.credential
            where provider='password' and subject_hash=$1 and status='active'`,
            [subjectHash]
          );
          if (existing.rows[0]) reject(409, 'IDENTITY_SUBJECT_EXISTS');
          const inviteHash = digest(textField(body, 'invite'));
          await consumeChallenge(database, textField(body, 'challenge'), textField(body, 'code'),
            (challenge, code) => codeDigest(challenge, `${code}:${inviteHash}`), undefined,
            { purpose: 'registration', destinationHash: subjectHash });
          const invitation = await requireValidInvite(memberPort.consumeInvite(database, inviteHash, subjectHash));
          const organization = invitation.organization_id;
          if (body.termsAccepted !== true || body.termsHash !== invitation.terms_hash) throw new Error('TERMS_ACCEPTANCE_REQUIRED');
          await database.query(`insert into identity.principal(id,status,created_at,updated_at) values($1,'active',clock_timestamp(),clock_timestamp())`, [principal]);
          await database.query(
            `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
          values($1,$2,'password',$3,$4,'active',clock_timestamp())`,
            [credential, principal, subjectHash, password]
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
          await database.query(
            `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
            values($1,$2,'phone_otp',2,$3,clock_timestamp(),clock_timestamp()+interval '365 days')`,
            [assurance, principal, subjectHash]
          );
          const scopeKind = await organizationPort.kind(database, organization);
          const result =
            invitation.target_client === 'operator'
              ? await accessPort.createOperatorRegistration(database, {
                  storefrontMembership: membership,
                  operatorMembership,
                  member,
                  principal,
                  operatorOrganization: organization,
                  storefrontOrganization: invitation.storefront_organization_id!,
                  operatorRole: invitation.role_id,
                  storefrontRole: 'role-zhudatuan-storefront-member',
                  storefrontScopes: [scopes[0], scopes[1], scopes[2]],
                  operatorScopes: [scopes[3], scopes[4]],
                })
              : await accessPort.createRegistration(database, {
                  membership,
                  member,
                  principal,
                  organization,
                  role: invitation.role_id,
                  scopeKind,
                  scopes: [scopes[0], scopes[1], scopes[2]],
                });
          if (typeof body.wechatToken === 'string') await bindWechat(database, tokenHash(body.wechatToken), principal, membership);
          await publishIdentityEvent(database, 'identity.member.registered', principal, organization, request.input.idempotency!, {
            principal,
            member,
            membership,
            ...(invitation.target_client === 'operator' ? { operatorMembership } : {}),
          });
          return { status: 201, body: result };
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
          const username = textField(body, 'username', 128).trim();
          const password = await passwords.hash(textField(body, 'password', 128));
          const principal = `principal:${randomUUID()}`;
          const member = `member:${randomUUID()}`;
          const membership = membershipId === 'new' ? `membership:${randomUUID()}` : membershipId;
          const credential = `credential:${randomUUID()}`;
          const role = await database.query<{ id: string }>(
            `select id from access.role where scope_id=$1 and status='active'
          and id='role-employee' limit 1`,
            [access.scope.id]
          );
          if (!role.rows[0]) throw new Error('EMPLOYEE_ROLE_NOT_FOUND');
          const exists = await database.query('select 1 from identity.credential where provider=$1 and subject_hash=$2', ['password', digest(username)]);
          if (exists.rows[0]) throw new Error('IDENTITY_SUBJECT_EXISTS');
          await database.query(`insert into identity.principal(id,status,created_at,updated_at) values($1,'active',clock_timestamp(),clock_timestamp())`, [principal]);
          await database.query(
            `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
          values($1,$2,'password',$3,$4,'active',clock_timestamp())`,
            [credential, principal, digest(username), password]
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
          await database.query('update access.membership set employee_no=$2 where id=$1', [membership, typeof body.employeeNo === 'string' ? body.employeeNo.trim() || null : null]);
          return { status: 201, body: { ...result, membershipId: membership, memberId: member, userId: principal } };
        }
        const target = await database.query<{ member_id: string }>(
          `select member_id from access.membership where id=$1
        and access.scope_allowed(organization_id) for update`,
          [membershipId]
        );
        if (!target.rows[0]) throw new Error('MEMBERSHIP_NOT_FOUND');
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
        const reason = textField(bodyRecord(request), 'reason', 500).trim();
        if (reason.length < 4) reject(422, 'CHANGE_REASON_REQUIRED');
        const expectedVersion = request.input.expectedVersion;
        if (expectedVersion === undefined) reject(400, 'EXPECTED_VERSION_REQUIRED');

        const root = await database.query(`select 1 from access.membership membership
          join access.membershiprole assignment on assignment.membership_id=membership.id
            and assignment.role_id='role-platform-owner-v2'
            and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
          where membership.id=$1 and membership.status='active'`, [access.membership.id]);
        if (!root.rows[0]) reject(403, 'PERMISSION_DENIED');

        const target = await database.query<{
          member_id: string; principal_id: string; principal_status: string; principal_version: number; organization_id: string;
        }>(`select membership.member_id,profile.principal_id,principal.status principal_status,
          principal.version principal_version,membership.organization_id
          from access.membership membership
          join member.profile profile on profile.id=membership.member_id
          join identity.principal principal on principal.id=profile.principal_id
          where membership.id=$1 and access.scope_allowed(membership.organization_id)
          for update of membership,profile,principal`, [request.input.path.membershipid!]);
        const selected = target.rows[0];
        if (!selected) reject(404, 'MEMBERSHIP_NOT_FOUND');
        if (selected.principal_id === access.actor.id) reject(409, 'OWNER_MEMBERSHIP_PROTECTED');
        if (Number(selected.principal_version) !== expectedVersion) reject(409, 'VERSION_CONFLICT');

        const protectedOwner = await database.query(`select 1 from access.membership membership
          join access.membershiprole assignment on assignment.membership_id=membership.id
            and assignment.role_id='role-platform-owner-v2'
            and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
          where membership.member_id=$1 and membership.status='active'`, [selected.member_id]);
        if (protectedOwner.rows[0]) reject(409, 'OWNER_MEMBERSHIP_PROTECTED');

        const memberships = await database.query<{ id: string; organization_id: string }>(
          `select id,organization_id from access.membership where member_id=$1 for update`, [selected.member_id]
        );
        if (memberships.rows.length === 0) reject(404, 'MEMBERSHIP_NOT_FOUND');
        const outsideScope = await database.query(`select 1 from access.membership
          where member_id=$1 and not access.scope_allowed(organization_id) limit 1`, [selected.member_id]);
        if (outsideScope.rows[0]) reject(409, 'IDENTITY_RESET_SCOPE_CONFLICT');

        const reauthenticated = await database.query(`select 1 from identity.assurance
          where principal_id=$1 and session_id=$2 and method='password' and level>=2
            and verified_at>clock_timestamp()-interval '10 minutes'
            and (expires_at is null or expires_at>clock_timestamp()) limit 1`, [access.actor.id, access.actor.session]);
        if (!reauthenticated.rows[0]) reject(403, 'IDENTITY_REAUTH_REQUIRED');

        const credentials = await database.query<{ id: string; provider: string; status: string; subject_hash: string }>(
          `select id,provider,status,subject_hash from identity.credential where principal_id=$1 for update`, [selected.principal_id]
        );
        const activePassword = credentials.rows.filter((credential) => credential.provider === 'password' && credential.status === 'active');
        if (selected.principal_status !== 'active' || activePassword.length === 0) reject(409, 'IDENTITY_ACCOUNT_ALREADY_RELEASED');
        for (const credential of activePassword) await database.query('select pg_advisory_xact_lock(hashtext($1))', [credential.subject_hash]);

        const reset = `reset:${randomUUID()}`;
        const membershipIds = memberships.rows.map(({ id }) => id);
        await database.query(`update identity.authticket set consumed_at=coalesce(consumed_at,clock_timestamp())
          where session_id in(select id from identity.session where principal_id=$1)`, [selected.principal_id]);
        await database.query(`update identity.session set revoked_at=coalesce(revoked_at,clock_timestamp()),
          revoked_reason=coalesce(revoked_reason,'identity_reset') where principal_id=$1`, [selected.principal_id]);
        await database.query(`update identity.assurance set expires_at=case when expires_at is null or expires_at>clock_timestamp()
          then clock_timestamp() else expires_at end where principal_id=$1`, [selected.principal_id]);
        await database.query(`delete from identity.challengesecret secret using identity.challenge challenge
          where secret.challenge_id=challenge.id and (challenge.principal_id=$1 or challenge.destination_hash::text=any($2::text[]))`,
        [selected.principal_id, activePassword.map(({ subject_hash }) => subject_hash)]);
        await database.query(`update identity.challenge set consumed_at=coalesce(consumed_at,clock_timestamp())
          where principal_id=$1 or destination_hash::text=any($2::text[])`, [selected.principal_id, activePassword.map(({ subject_hash }) => subject_hash)]);
        await database.query(`delete from identity.loginattempt where subject_hash::text=any($1::text[])`, [activePassword.map(({ subject_hash }) => subject_hash)]);

        const federated = await database.query<{ id: string }>(`select id from identity.federatedidentity where principal_id=$1 for update`, [selected.principal_id]);
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
          where id=$1`, [selected.member_id]);
        const result = await database.query<{ version: number }>(`update identity.principal set status='disabled',
          credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp()
          where id=$1 returning version`, [selected.principal_id]);
        const version = Number(result.rows[0]?.version);
        if (!Number.isSafeInteger(version)) throw new Error('IDENTITY_RESET_FAILED');
        await publishIdentityEvent(database, 'identity.member.reset', selected.principal_id, selected.organization_id,
          request.input.idempotency!, { principal: selected.principal_id, memberships: membershipIds, reason });
        return { status: 200, body: { principal_id: selected.principal_id, status: 'reset', login_identity_released: true, history_retained: true, version } };
      },
      'identity.password.change': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const body = bodyRecord(request);
          const currentPassword = textField(body, 'currentPassword', 128);
          const hash = await passwords.hash(textField(body, 'newPassword', 128));
          return { access, currentPassword, hash };
        },
        execute: async (_request, database, { access, currentPassword, hash }) => {
          await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'))");
          const credential = await database.query<{ id: string; secret_hash: string }>(`select id,secret_hash from identity.credential where principal_id=$1 and provider='password' and status='active' for update`, [access.actor.id]);
          const found = credential.rows[0];
          if (!found || !(await passwords.verify(currentPassword, found.secret_hash))) throw new Error('CREDENTIAL_INVALID');
          const evidenceHash = sessionDigest(access.actor.session);
          await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
            values($1,$2,'password',2,$3,clock_timestamp(),clock_timestamp()+interval '10 minutes')`,
          [`assurance:${randomUUID()}`, access.actor.id, evidenceHash]);
          const ownerRotation = await database.query<{ result: Readonly<Record<string, unknown>> | null }>(
            `select identity.rotate_zhudatuan_owner_password($1,$2,null::text,$3,'credential_changed') result`,
            [access.actor.id, access.actor.session, hash]
          );
          const ownerResult = ownerRotation.rows[0]?.result;
          if (ownerResult) return { status: 200, body: ownerResult, headers: sessionCookies('', '', 0) };
          await database.query('update identity.credential set secret_hash=$2,rotated_at=clock_timestamp() where id=$1', [found.id, hash]);
          const result = await database.query('update identity.principal set credential_version=credential_version+1,updated_at=clock_timestamp(),version=version+1 where id=$1 returning credential_version,version', [access.actor.id]);
          await database.query("update identity.session set revoked_at=clock_timestamp(),revoked_reason='credential_changed' where principal_id=$1 and id<>$2 and revoked_at is null", [access.actor.id, access.actor.session]);
          return rowResult(result);
        },
      }),
      'identity.password.verify': async (request, database) => {
        const access = requireAccess(request);
        const password = textField(bodyRecord(request), 'password', 128);
        const credential = await database.query<{ secret_hash: string | null }>(
          `select secret_hash from identity.credential
        where principal_id=$1 and provider='password' and status='active'`,
          [access.actor.id]
        );
        if (!(await passwords.verify(password, credential.rows[0]?.secret_hash ?? null))) reject(401, 'CREDENTIAL_INVALID');
        const verifiedAt = new Date().toISOString();
        await database.query(
          `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
        values($1,$2,$3,'password',2,$4,$5::timestamptz,$5::timestamptz+interval '10 minutes')`,
          [`assurance:${randomUUID()}`, access.actor.id, access.actor.session, digest(access.actor.session), verifiedAt]
        );
        await database.query(
          `update identity.session set assurance_level=greatest(assurance_level,2),last_seen_at=clock_timestamp()
        where id=$1 and principal_id=$2 and revoked_at is null`,
          [access.actor.session, access.actor.id]
        );
        return { status: 200, body: { verified: true, verifiedAt } };
      },
      'identity.password.reset': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const challenge = textField(body, 'challenge');
          const hash = await passwords.hash(textField(body, 'newPassword', 128));
          return { body, challenge, hash };
        },
        execute: async (_request, database, { body, challenge, hash }) => {
          const consumed = await consumeChallenge(database, challenge, textField(body, 'code'), codeDigest, undefined, { purpose: 'password_reset' });
          const principal = consumed.principal_id;
          if (!principal) reject(400, 'CHALLENGE_PRINCIPAL_MISSING');
          const ownerRotation = await database.query<{ result: Readonly<Record<string, unknown>> | null }>(
            `select identity.rotate_zhudatuan_owner_password($1,null::text,$2,$3,'credential_reset') result`,
            [principal, challenge, hash]
          );
          const ownerResult = ownerRotation.rows[0]?.result;
          if (ownerResult) return { status: 200, body: ownerResult, headers: sessionCookies('', '', 0) };
          await database.query("update identity.credential set secret_hash=$2,rotated_at=clock_timestamp() where principal_id=$1 and provider='password' and status='active'", [principal, hash]);
          const result = await database.query('update identity.principal set credential_version=credential_version+1,updated_at=clock_timestamp(),version=version+1 where id=$1 returning credential_version,version', [principal]);
          await database.query("update identity.session set revoked_at=clock_timestamp(),revoked_reason='credential_reset' where principal_id=$1 and revoked_at is null", [principal]);
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
          const result = await database.query(
            `with challenge as (
          insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,session_hash,attempts,expires_at,created_at)
          values($1,$2,'phone_change',$3,$4,$5,0,clock_timestamp()+interval '10 minutes',clock_timestamp()) returning id,purpose,expires_at
        ), secret as (insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,destination_key_version,created_at)
          values($1,$6,$7,$8,$9,clock_timestamp())) select * from challenge`,
            [id, access.actor.id, destinationHash, codeDigest(id, code), sessionDigest(access.actor.session),
              envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion]
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
          await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'))");
          const profile = await database.query<{ mobile_ciphertext: string | null }>(
            `select mobile_ciphertext from member.profile where principal_id=$1 and status='active' for update`, [access.actor.id]);
          const current = profile.rows[0];
          if (!current) reject(404, 'RESOURCE_NOT_FOUND');
          if (current.mobile_ciphertext === null) {
            const passwordEvidence = await database.query(`select 1 from identity.assurance where principal_id=$1 and method='password' and level=2
              and evidence_hash=$2 and verified_at>=clock_timestamp()-interval '10 minutes'
              and expires_at>clock_timestamp() limit 1`, [access.actor.id, sessionDigest(access.actor.session)]);
            if (!passwordEvidence.rows[0]) reject(403, 'MOBILE_ENROLLMENT_PASSWORD_REQUIRED');
          } else if (!stepup.accepts(true, access.assurance, new Date())) reject(403, 'MOBILE_CHANGE_STEP_UP_REQUIRED');
          await consumeChallenge(database, textField(body, 'challenge'), textField(body, 'code'), codeDigest, access.actor.id,
            { purpose: 'phone_change', destinationHash: digest(mobile), sessionHash: sessionDigest(access.actor.session) });
          const owner = await database.query<{ exact_owner: boolean }>('select access.zhudatuan_owner_context() exact_owner');
          if (owner.rows[0]?.exact_owner === true) {
            const changed = await database.query<{ profile: Readonly<Record<string, unknown>> }>(
              `select access.change_zhudatuan_owner_mobile($1,$2,$3,$4,$5,$6,$7,$8,$9) profile`,
              [access.actor.id, access.actor.session, textField(body, 'challenge'), envelope.ciphertext,
                digest(mobile), envelope.fingerprint, maskMobile(mobile), sessionDigest(access.actor.session), sessionDigest(access.actor.session)]);
            const result = changed.rows[0]?.profile;
            if (!result) throw new Error('MEMBER_PROFILE_NOT_FOUND');
            return { status: 200, body: result, headers: { ...sessionCookies('', '', 0), etag: `\"${String(result.version)}\"` } };
          }
          const credential = await database.query<{ id: string }>(`select id from identity.credential where principal_id=$1 and provider='password' and status='active' for update`, [access.actor.id]);
          if (!credential.rows[0]) throw new Error('CREDENTIAL_NOT_FOUND');
          await database.query(`update identity.credential set subject_hash=$2,rotated_at=clock_timestamp() where id=$1`, [credential.rows[0].id, digest(mobile)]);
          const result = await memberPort.changeMobile(database, access.actor.id, envelope.ciphertext, envelope.fingerprint, maskMobile(mobile));
          await database.query(`update identity.assurance set expires_at=least(coalesce(expires_at,clock_timestamp()),clock_timestamp())
            where principal_id=$1 and method='phone_otp' and (expires_at is null or expires_at>clock_timestamp())`, [access.actor.id]);
          await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
            values($1,$2,'phone_otp',2,$3,clock_timestamp(),clock_timestamp()+interval '365 days')`,
          [`assurance:${randomUUID()}`, access.actor.id, digest(mobile)]);
          await database.query(`update identity.principal set credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp() where id=$1`, [access.actor.id]);
          await database.query("update identity.session set revoked_at=clock_timestamp(),revoked_reason='mobile_changed' where principal_id=$1 and revoked_at is null", [access.actor.id]);
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
          const profile = await database.query<{ mobile_ciphertext: string | null }>(
            `select mobile_ciphertext from member.profile where principal_id=$1 and status='active'`, [access.actor.id]);
          const ciphertext = profile.rows[0]?.mobile_ciphertext;
          if (!ciphertext) throw new Error('STEP_UP_DESTINATION_MISSING');
          const destination = await kms.decrypt('identity/mobile', ciphertext, { principal: access.actor.id });
          const [envelope, recipient] = await Promise.all([kms.encrypt('identity/challenge', code, { challenge: id, purpose: 'stepup' }), kms.encrypt('identity/destination', destination, { challenge: id, purpose: 'stepup' })]);
          const result = await database.query(
            `with challenge as (insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,session_hash,attempts,expires_at,created_at)
        values($1,$2,'stepup',$3,$4,$5,0,clock_timestamp()+interval '5 minutes',clock_timestamp()) returning id,purpose,expires_at),
        secret as (insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,destination_key_version,created_at)
          values($1,$6,$7,$8,$9,clock_timestamp())) select * from challenge`,
            [id, access.actor.id, digest(destination), codeDigest(id, code), sessionDigest(access.actor.session),
              envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion]
          );
          await database.query(
            `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'identitynotification','identity',$2,jsonb_build_object('challenge',$3),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
            [`job:notify:${id}`, access.scope.id, id]
          );
          await publishIdentityEvent(database, 'identity.challenge.started', id, access.scope.id, request.input.idempotency!, { challenge: id, purpose: 'stepup' });
          return rowResult(result, 202);
        },
      }),
      'identity.stepup.complete': async (request, database) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const action = financialActionRequest(body.action);
        const challenge = textField(body, 'challenge');
        const profile = await database.query<{ mobile_ciphertext: string | null }>(
          `select mobile_ciphertext from member.profile where principal_id=$1 and status='active'`, [access.actor.id]);
        const ciphertext = profile.rows[0]?.mobile_ciphertext;
        if (!ciphertext) throw new Error('STEP_UP_DESTINATION_MISSING');
        const destination = await kms.decrypt('identity/mobile', ciphertext, { principal: access.actor.id });
        await consumeChallenge(database, challenge, textField(body, 'code'), codeDigest, access.actor.id,
          { purpose: 'stepup', destinationHash: digest(destination), sessionHash: sessionDigest(access.actor.session) });
        const assurance = `assurance:${randomUUID()}`;
        if (action === null) {
          await database.query(
            `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
          values($1,$2,'otp',3,$3,clock_timestamp(),clock_timestamp()+interval '15 minutes')`,
            [assurance, access.actor.id, sessionDigest(access.actor.session)]
          );
        } else {
          await database.query(
            `insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
          values($1,$2,$3,'otp',3,$4,clock_timestamp(),clock_timestamp()+interval '15 minutes')`,
            [assurance, access.actor.id, access.actor.session, digest(challenge)]
          );
        }
        const result = await database.query(
          `update identity.session set assurance_level=3,last_seen_at=clock_timestamp()
        where id=$1 and principal_id=$2 and revoked_at is null returning id,assurance_level`,
          [access.actor.session, access.actor.id]
        );
        const session = result.rows[0];
        if (!session) throw new Error('AUTHENTICATION_REQUIRED');
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

async function requireInvitationManager(request: OperationRequest, database: OperationDatabase, registrationOnly: boolean) {
  const access = requireAccess(request);
  const permission = access.membership.grants.some((grant) => grant.permissions.includes('identity.invitation.manage'));
  if (access.actor.target !== 'console' || !access.capabilities.includes(request.type) || !permission) reject(403, 'PERMISSION_DENIED');
  const exactOwner = await zhudatuanInvitationOwner(database, registrationOnly);
  if (registrationOnly && !exactOwner) reject(403, 'PERMISSION_DENIED');
  return { access, exactOwner };
}

async function zhudatuanInvitationOwner(database: OperationDatabase, registrationOnly: boolean): Promise<boolean> {
  const probe = registrationOnly ? 'access.zhudatuan_invitation_owner()' : 'access.zhudatuan_owner_context()';
  const result = await database.query<{ exact_owner: boolean }>(`select ${probe} exact_owner`);
  return result.rows[0]?.exact_owner === true;
}

async function requireValidInvite<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'INVITE_INVALID') reject(400, 'INVITE_INVALID');
    throw cause;
  }
}

function maskMobile(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
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
