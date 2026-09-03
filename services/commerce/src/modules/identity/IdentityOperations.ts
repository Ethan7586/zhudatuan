import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { canonicalFinancialActionRequest, requiresFinancialActionProof, requiresFinancialExpectedVersion, type OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, pageResult, reject, requireAccess, rowResult, type OperationActions } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../foundation/interface/Validation';
import type { OperationRequest, OperationUsecase } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { RISK_GATE } from '../../foundation/security/RiskGate';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { PasswordPolicy } from './domain/policy/PasswordPolicy';
import { bindWechat, publishIdentityEvent, tokenHash } from './IdentityPersistence';
import { AuthTransaction } from './domain/model/AuthTransaction';
import { PgAuthTicket } from './infrastructure/PgAuthTicket';
import { RETURN_TARGETS } from './infrastructure/ReturnTargetCatalog';
import { ReturnTargetSigner } from './infrastructure/ReturnTargetSigner';
import { assertLoginAllowed, assertPublicRisk, authTarget, consumeChallenge, consumeChallengeRate, recordLoginFailure, requestCookie, sessionCookies } from './IdentitySecurity';
import { accessPort } from '../access/AccessPort';
import { memberPort } from '../member/MemberPort';
import { organizationPort } from '../organization/OrganizationPort';
import { canonicalIdentitySubject, canonicalMobile, identitySubjectVariants } from './IdentitySubject';

const CORE_OPERATIONS = [
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
  'identity.password.change',
  'identity.password.verify',
  'identity.password.reset',
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
] as const satisfies readonly OperationId[];

export function identityOperations(context: ModuleContext): OperationUsecase {
  return identityCoreOperations(context, IDENTITY_CORE_OPERATION_IDS, false);
}

export function identityRegistrationOperations(context: ModuleContext): OperationUsecase {
  return identityCoreOperations(context, IDENTITY_REGISTRATION_OPERATION_IDS, true);
}

export function identityCoreOperations(context: ModuleContext, ownedOperations: readonly OperationId[], registrationOnly = false): OperationUsecase {
  const pool = context.container.get(DATABASE_POOL);
  const audit = context.container.get(AUDIT_SINK);
  const keys = context.container.get(IDENTITY_SECURITY_KEYS);
  const kms = context.container.get(KMS_CLIENT);
  const passwords = new PasswordPolicy();
  const stepup = new StepupPolicy();
  const tickets = new PgAuthTicket(new ReturnTargetSigner(context.container.get(RETURN_TARGETS), keys.session));
  const digest = (value: string) => createHmac('sha256', keys.identity).update(value.trim().toLowerCase()).digest('hex');
  const codeDigest = (challenge: string, code: string) => createHmac('sha256', keys.session).update(`${challenge}:${code}`).digest('hex');
  const core = new ModuleOperations(
    'identity',
    pool,
    audit,
    {
      'identity.sessions.create': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const authorization = AuthTransaction.start(body.authorization);
          const subject = digest(textField(body, 'subject'));
          const peer = digest(request.input.headers['x-peer-address'] ?? 'unknown');
          const device = digest(request.input.headers['x-device-id'] ?? 'unknown');
          const client = digest(`${peer}:${request.input.headers['user-agent'] ?? 'unknown'}:${device}`);
          await assertPublicRisk(risk, request, subject, client);
          return {
            body,
            authorization,
            subject,
            client,
            rateKeys: [
              [subject, client],
              [subject, 'account'],
              [peer, 'network'],
              [device, 'device'],
            ] as const,
          };
        },
        execute: async (request, database, { body, authorization, subject, client, rateKeys }) => {
          await assertLoginAllowed(database, rateKeys);
          const credential = await database.query<{ principal_id: string; secret_hash: string | null; credential_version: number }>(
            `select credential.principal_id,credential.secret_hash,principal.credential_version
          from identity.credential credential join identity.principal principal on principal.id=credential.principal_id
          where credential.provider=$1 and credential.subject_hash=$2 and credential.status='active' and principal.status='active' for update`,
            [body.provider ?? 'password', subject]
          );
          const found = credential.rows[0];
          if (!(await passwords.verify(textField(body, 'password', 128), found?.secret_hash ?? null))) {
            await recordLoginFailure(database, rateKeys);
            reject(401, 'CREDENTIAL_INVALID');
          }
          if (!found) reject(401, 'CREDENTIAL_INVALID');
          await database.query("delete from identity.loginattempt where subject_hash=$1 and client_hash in($2,'account')", [subject, client]);
          const memberships = await database.query<{ id: string; access_version: number; client: string }>(
            `select membership.id,membership.access_version,membership.client from member.profile profile
          join access.membership membership on membership.member_id=profile.id where profile.principal_id=$1 and membership.status='active' order by membership.id`,
            [found.principal_id]
          );
          const requestedTarget = typeof body.target === 'string' ? authTarget(body.target) : undefined;
          const candidates = requestedTarget === undefined
            ? memberships.rows
            : memberships.rows.filter((item) => authTarget(item.client) === requestedTarget);
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
          const token = randomBytes(48).toString('base64url');
          const id = `session:${randomUUID()}`;
          await database.query(
            `insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,clock_timestamp()+interval '12 hours',clock_timestamp(),clock_timestamp())`,
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
            ]
          );
          await publishIdentityEvent(database, 'identity.session.created', id, membership.id, request.input.idempotency!, { principal: found.principal_id, membership: membership.id });
          const csrf = randomBytes(32).toString('base64url');
          const target = authTarget(membership.client);
          const callback = await tickets.issue(database, id, target, authorization);
          return { status: 201, body: { session: id, csrf, expiresIn: 43_200, membership: membership.id, target, callback }, headers: sessionCookies(token, csrf, 43_200) };
        },
      }),
      'identity.tickets.exchange': async (request, database) => {
        const currentToken = requestCookie(request.input.headers.cookie, 'shop_session');
        if (!currentToken) reject(401, 'AUTHENTICATION_REQUIRED');
        const exchanged = await tickets.consume(database, request.input.body, currentToken);
        const expiresIn = Math.max(1, Math.min(43_200, Math.floor((exchanged.sessionExpiresAt.getTime() - Date.now()) / 1_000)));
        return {
          status: 200,
          body: { returnTarget: exchanged.returnTarget, expiresIn },
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
          const destination = textField(body, 'destination').trim();
          const purpose = textField(body, 'purpose');
          if (!['registration', 'password_reset', 'phone_change', 'stepup', 'wechat_bind'].includes(purpose)) throw new Error('CHALLENGE_PURPOSE_INVALID');
          if (purpose === 'registration' && !/^\+?[1-9][0-9]{7,14}$/.test(destination)) throw new Error('MOBILE_INVALID');
          const destinationHash = digest(destination);
          const device = digest(request.input.headers['x-device-id'] ?? 'unknown');
          const peer = digest(request.input.headers['x-peer-address'] ?? 'unknown');
          await assertPublicRisk(risk, request, destinationHash, device);
          const [envelope, recipient] = await Promise.all([kms.encrypt('identity/challenge', code, { challenge: id, purpose }), kms.encrypt('identity/destination', destination, { challenge: id, purpose })]);
          return { body, id, code, purpose, destinationHash, device, peer, envelope, recipient };
        },
        execute: async (request, database, prepared) => {
          const { body, id, code, purpose, destinationHash, device, peer, envelope, recipient } = prepared;
          await consumeChallengeRate(database, [
            [destinationHash, purpose],
            [peer, `network:${purpose}`],
            [device, `device:${purpose}`],
          ]);
          let principal = typeof body.principal === 'string' ? body.principal : null;
          if (purpose === 'password_reset') {
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
            [id, principal, purpose, destinationHash, codeDigest(id, code), envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion]
          );
          await database.query(
            `insert into runtime.job(id,kind,owner,payload,state,priority,available_at,created_at,updated_at)
          values($1,'notification','identity',jsonb_build_object('challenge',$2::text),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
            [`job:notify:${id}`, id]
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
        const maxUses = integerField(body, 'maxUses', 1);
        const expiresAt = inviteExpiry(body.expiresAt);
        if (label.length < 2 || maxUses > 500) throw new Error('INVALID_INVITATION_INPUT');
        const role = await database.query<{ id: string }>(`select role.id from access.role role where role.id='role-employee'
        and role.status='active' and access.scope_allowed(role.scope_id)`);
        if (!role.rows[0]) throw new Error('EMPLOYEE_ROLE_NOT_FOUND');
        const policy = await database.query<{ id: string; terms_hash: string }>(`select id,terms_hash from identity.registrationpolicy
        where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp()) order by version desc limit 1`);
        if (!policy.rows[0]) throw new Error('INVITE_INVALID');
        const id = `invite:${randomUUID()}`;
        const code = randomBytes(24).toString('base64url');
        const result = await database.query(
          `insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
        role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,registration_policy_id,terms_hash,version)
        values($1,$2,$3,$4,$5,$6,$7,$8,null,$9,0,clock_timestamp(),'active',clock_timestamp(),$10,$11,0)
        returning id,label,'storefront' target,max_uses,use_count,effective_at starts_at,expires_at,status,created_at,version`,
          [id, access.scope.id, label, digest(id), digest(code), expiresAt, access.membership.id, role.rows[0].id, maxUses, policy.rows[0].id, policy.rows[0].terms_hash]
        );
        const saved = result.rows[0];
        if (!saved) throw new Error('INVITE_INVALID');
        return { status: 201, body: { ...saved, code }, headers: { etag: '"0"' } };
      },
      'identity.invitations.revoke': async (request, database) => {
        requireAccess(request);
        const body = bodyRecord(request);
        const reason = textField(body, 'reason', 1000);
        if (reason.length < 4) throw new Error('CHANGE_REASON_REQUIRED');
        const id = request.input.path.invitationid!;
        const result = await database.query(
          `update member.invite set status='disabled',version=version+1
        where id=$1 and access.scope_allowed(organization_id) and status='active' and ($2::bigint is null or version=$2)
        returning id,label,'storefront' target,max_uses,use_count,effective_at starts_at,expires_at,status,created_at,version`,
          [id, request.input.expectedVersion ?? null]
        );
        if (result.rows[0]) return rowResult(result);
        const current = await database.query<{ status: string; version: number }>(
          `select status,version from member.invite
        where id=$1 and access.scope_allowed(organization_id)`,
          [id]
        );
        if (!current.rows[0]) throw new Error('INVITATION_NOT_FOUND');
        if (request.input.expectedVersion !== undefined && current.rows[0].version !== request.input.expectedVersion) throw new Error('VERSION_CONFLICT');
        return { status: 200, body: { id, status: current.rows[0].status, version: current.rows[0].version }, headers: { etag: `"${String(current.rows[0].version)}"` } };
      },
      'identity.members.create': operationLifecycle({
        prepare: async (request) => {
          const body = bodyRecord(request);
          const subject = textField(body, 'subject').trim();
          if (!/^\+?[1-9][0-9]{7,14}$/.test(subject)) throw new Error('MOBILE_INVALID');
          await assertPublicRisk(risk, request, digest(subject), digest(request.input.headers['x-device-id'] ?? 'unknown'));
          const password = await passwords.hash(textField(body, 'password', 128));
          return {
            body,
            subject,
            password,
            principal: `principal:${randomUUID()}`,
            member: `member:${randomUUID()}`,
            membership: `membership:${randomUUID()}`,
            credential: `credential:${randomUUID()}`,
            scopes: [`scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`] as const,
          };
        },
        execute: async (request, database, prepared) => {
          const { body, subject, password, principal, member, membership, credential, scopes } = prepared;
          const subjectHash = digest(subject);
          await database.query('select pg_advisory_xact_lock(hashtext($1))', [subjectHash]);
          const existing = await database.query(`select 1 from identity.credential
            where provider='password' and subject_hash=$1 and status='active'`, [subjectHash]);
          if (existing.rows[0]) reject(409, 'IDENTITY_SUBJECT_EXISTS');
          await consumeChallenge(database, textField(body, 'challenge'), textField(body, 'code'), codeDigest, undefined,
            { purpose: 'registration', destinationHash: subjectHash });
          const inviteHash = digest(textField(body, 'invite'));
          const invitation = await memberPort.consumeInvite(database, inviteHash, subjectHash);
          const organization = invitation.organization_id;
          if (body.termsAccepted !== true || body.termsHash !== invitation.terms_hash) throw new Error('TERMS_ACCEPTANCE_REQUIRED');
          await database.query(`insert into identity.principal(id,status,created_at,updated_at) values($1,'active',clock_timestamp(),clock_timestamp())`, [principal]);
          await database.query(
            `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
          values($1,$2,'password',$3,$4,'active',clock_timestamp())`,
            [credential, principal, subjectHash, password]
          );
          await memberPort.create(database, { member, principal, display: textField(body, 'displayName'), status: 'active' });
          const scopeKind = await organizationPort.kind(database, organization);
          const result = await accessPort.createRegistration(database, { membership, member, principal, organization, role: invitation.role_id, scopeKind, scopes });
          if (typeof body.wechatToken === 'string') await bindWechat(database, tokenHash(body.wechatToken), principal, membership);
          await publishIdentityEvent(database, 'identity.member.registered', principal, organization, request.input.idempotency!, { principal, member, membership });
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
      'identity.password.change': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const body = bodyRecord(request);
          const currentPassword = textField(body, 'currentPassword', 128);
          const hash = await passwords.hash(textField(body, 'newPassword', 128));
          return { access, currentPassword, hash };
        },
        execute: async (_request, database, { access, currentPassword, hash }) => {
          const credential = await database.query<{ id: string; secret_hash: string }>(`select id,secret_hash from identity.credential where principal_id=$1 and provider='password' and status='active' for update`, [access.actor.id]);
          const found = credential.rows[0];
          if (!found || !(await passwords.verify(currentPassword, found.secret_hash))) throw new Error('CREDENTIAL_INVALID');
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
          `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
        values($1,$2,'password',2,$3,$4::timestamptz,$4::timestamptz+interval '10 minutes')`,
          [`assurance:${randomUUID()}`, access.actor.id, digest(access.actor.session), verifiedAt]
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
          await assertPublicRisk(risk, request, digest(challenge), digest(request.input.headers['x-device-id'] ?? 'unknown'));
          const hash = await passwords.hash(textField(body, 'newPassword', 128));
          return { body, challenge, hash };
        },
        execute: async (_request, database, { body, challenge, hash }) => {
          const consumed = await consumeChallenge(database, challenge, textField(body, 'code'), codeDigest, undefined,
            { purpose: 'password_reset' });
          const principal = consumed.principal_id;
          if (!principal) reject(400, 'CHALLENGE_PRINCIPAL_MISSING');
          await database.query("update identity.credential set secret_hash=$2,rotated_at=clock_timestamp() where principal_id=$1 and provider='password' and status='active'", [principal, hash]);
          const result = await database.query('update identity.principal set credential_version=credential_version+1,updated_at=clock_timestamp(),version=version+1 where id=$1 returning credential_version,version', [principal]);
          await database.query("update identity.session set revoked_at=clock_timestamp(),revoked_reason='credential_reset' where principal_id=$1 and revoked_at is null", [principal]);
          return rowResult(result);
        },
      }),
      'identity.mobile.manage': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const body = bodyRecord(request);
          const mobile = textField(body, 'mobile', 32).trim();
          if (!/^\+?[1-9][0-9]{7,14}$/.test(mobile)) throw new Error('MOBILE_INVALID');
          const envelope = await kms.encrypt('identity/mobile', mobile, { principal: access.actor.id });
          return { access, body, mobile, envelope };
        },
        execute: async (_request, database, { access, body, mobile, envelope }) => {
          await consumeChallenge(database, textField(body, 'challenge'), textField(body, 'code'), codeDigest, access.actor.id,
            { purpose: 'phone_change', destinationHash: digest(mobile) });
          const credential = await database.query<{ id: string }>(`select id from identity.credential where principal_id=$1 and provider='password' and status='active' for update`, [access.actor.id]);
          if (!credential.rows[0]) throw new Error('CREDENTIAL_NOT_FOUND');
          await database.query(`update identity.credential set subject_hash=$2,rotated_at=clock_timestamp() where id=$1`, [credential.rows[0].id, digest(mobile)]);
          const result = await memberPort.changeMobile(database, access.actor.id, envelope.ciphertext, envelope.fingerprint, maskMobile(mobile));
          await database.query(`update identity.principal set credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp() where id=$1`, [access.actor.id]);
          await database.query("update identity.session set revoked_at=clock_timestamp(),revoked_reason='mobile_changed' where principal_id=$1 and id<>$2 and revoked_at is null", [access.actor.id, access.actor.session]);
          return { status: 200, body: result, headers: { etag: `\"${String(result.version)}\"` } };
        },
      }),
      'identity.stepup.start': operationLifecycle({
        prepare: async (request) => {
          const access = requireAccess(request);
          const id = `challenge:${randomUUID()}`;
          const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
          const requested = bodyRecord(request).destination;
          const destination = typeof requested === 'string' && requested.trim().length > 0 ? requested.trim() : null;
          return { access, id, code, destination };
        },
        execute: async (request, database, { access, id, code, destination: requestedDestination }) => {
          let destination = requestedDestination;
          if (destination === null) {
            const profile = await database.query<{ mobile_ciphertext: string | null }>(
              `select mobile_ciphertext from member.profile
            where principal_id=$1 and status='active'`,
              [access.actor.id]
            );
            const ciphertext = profile.rows[0]?.mobile_ciphertext;
            if (!ciphertext) throw new Error('STEP_UP_DESTINATION_MISSING');
            destination = await kms.decrypt('identity/mobile', ciphertext, { principal: access.actor.id });
          }
          const [envelope, recipient] = await Promise.all([kms.encrypt('identity/challenge', code, { challenge: id, purpose: 'stepup' }), kms.encrypt('identity/destination', destination, { challenge: id, purpose: 'stepup' })]);
          await consumeChallengeRate(database, [
            [digest(`${access.actor.id}:${destination}`), 'stepup'],
            [digest(request.input.headers['x-peer-address'] ?? 'unknown'), 'network:stepup'],
            [digest(request.input.headers['x-device-id'] ?? 'unknown'), 'device:stepup'],
          ]);
          const result = await database.query(
            `with challenge as (insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at)
        values($1,$2,'stepup',$3,$4,0,clock_timestamp()+interval '5 minutes',clock_timestamp()) returning id,purpose,expires_at),
        secret as (insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,destination_key_version,created_at)
          values($1,$5,$6,$7,$8,clock_timestamp())) select * from challenge`,
            [id, access.actor.id, digest(destination), codeDigest(id, code), envelope.ciphertext, envelope.keyVersion, recipient.ciphertext, recipient.keyVersion]
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
        const challenge = textField(body, 'challenge');
        await consumeChallenge(database, challenge, textField(body, 'code'), codeDigest, access.actor.id, { purpose: 'stepup' });
        const assurance = `assurance:${randomUUID()}`;
        await database.query(
          `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
        values($1,$2,'otp',3,$3,clock_timestamp(),clock_timestamp()+interval '15 minutes')`,
          [assurance, access.actor.id, digest(challenge)]
        );
        const result = await database.query(
          `update identity.session set assurance_level=3,last_seen_at=clock_timestamp()
        where id=$1 and principal_id=$2 and revoked_at is null returning id,assurance_level`,
          [access.actor.session, access.actor.id]
        );
        return rowResult(result);
      },
    },
    CORE_OPERATIONS
  );
  return new WechatOperations(core, pool.workload('command'), context.container.get(WECHAT_IDENTITY), kms, audit, keys.identity, keys.session, tickets);
}

function maskMobile(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function inviteExpiry(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_INVITATION_INPUT');
  const time = new Date(value).getTime();
  const now = Date.now();
  if (!Number.isFinite(time) || time <= now + 10 * 60_000 || time > now + 90 * 24 * 60 * 60_000) throw new Error('INVALID_INVITATION_INPUT');
  return new Date(time).toISOString();
}
