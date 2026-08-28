import { constants } from 'node:fs';
import { access, chmod, link, lstat, open, readFile, unlink } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { Client } from 'pg';
import {
  REGISTRATION_BASELINE_VERSION,
  REGISTRATION_BOOTSTRAP_CONFIRMATION,
  REGISTRATION_INVITATION_ID,
  REGISTRATION_ORGANIZATION_ID,
  REGISTRATION_POLICY_ID,
  REGISTRATION_ROLE_ID,
  REGISTRATION_TERMS_HASH,
  assertExistingInvitation,
  assertRegistrationInvitationExportUsable,
  bootstrapSummary,
  createRegistrationInvitationExport,
  parseRegistrationInvitationExport,
  registrationBootstrapEnvironment,
  sha256,
  type ExistingInvitation,
  type RegistrationInvitationExport,
} from './RegistrationBootstrapPlan';

const environment = registrationBootstrapEnvironment(process.env);
const identityKey = await readSecret(environment.secretStoreEndpoint, environment.secretStoreBearerToken, environment.identityKeyRef);
const pendingPath = `${environment.outputPath}.pending`;
const database = new Client({
  connectionString: environment.connectionString,
  application_name: 'zhudatuan-registration-bootstrap-v1',
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

await database.connect();
let state: 'created' | 'existing' = 'existing';
let prepared: PreparedExport | null = null;
try {
  await database.query('begin isolation level serializable');
  await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:registration-bootstrap:v1'))");
  await assertDatabaseBoundary(database, environment.expectedDatabase, environment.sentinel);
  prepared = await prepareExport(environment.outputPath, pendingPath, environment.expiresInHours, identityKey);
  assertRegistrationInvitationExportUsable(prepared.document);
  const existing = await database.query<ExistingInvitation>(
    `select id,organization_id,label,destination_hash,token_hash,expires_at,
    created_by,role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,registration_policy_id,terms_hash
    from member.invite where id=$1`,
    [REGISTRATION_INVITATION_ID]
  );
  if (existing.rows[0]) {
    assertExistingInvitation(existing.rows[0], prepared.document, environment.actor);
  } else {
    await database.query(
      `insert into member.invite(
      id,organization_id,label,destination_hash,token_hash,expires_at,created_by,role_id,allowed_destination_hash,
      max_uses,use_count,effective_at,status,created_at,registration_policy_id,terms_hash,version
    ) values($1,$2,'主打团测试注册（一次）',$3,$4,$5,$6,$7,null,1,0,$8,'active',$8,$9,$10,0)`,
      [
        REGISTRATION_INVITATION_ID,
        REGISTRATION_ORGANIZATION_ID,
        sha256(REGISTRATION_INVITATION_ID),
        prepared.document.tokenHash,
        prepared.document.expiresAt,
        environment.actor,
        REGISTRATION_ROLE_ID,
        prepared.document.createdAt,
        REGISTRATION_POLICY_ID,
        REGISTRATION_TERMS_HASH,
      ]
    );
    await insertAuditRecord(database, prepared.document, environment.actor);
    state = 'created';
  }
  await assertAuditRecord(database, prepared.document, environment.actor);
  await database.query('commit');
} catch (cause) {
  await database.query('rollback').catch(() => undefined);
  throw cause;
} finally {
  await database.end();
}

if (!prepared) throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_NOT_PREPARED');
await promoteExport(environment.outputPath, pendingPath, prepared.source, identityKey);
process.stdout.write(`${bootstrapSummary(prepared.document, environment.outputPath, state)}\n`);

type PreparedExport = Readonly<{ document: RegistrationInvitationExport; source: 'final' | 'pending' }>;

async function assertDatabaseBoundary(database: Client, expectedDatabase: string, sentinel: string): Promise<void> {
  const result = await database.query<{
    database_name: string;
    database_role: string;
    role_safe: boolean;
    sentinel_valid: boolean;
    schema_version: string | null;
    organizations: number;
    policies: number;
    employee_roles: number;
    employee_permissions: number;
    employee_permission_mappings: number;
    employee_risky_permissions: number;
    self_roles: number;
    self_permissions: number;
    legacy_invites: number;
    legacy_employee_assignments: number;
    baseline_audits: number;
  }>(
    `select current_database() database_name,current_user database_role,
    not exists(select 1 from pg_roles where rolname=current_user
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)) role_safe,
    deployment.registration_bootstrap_boundary($6) sentinel_valid,
    (select version from runtime.schemaversion where version=$1) schema_version,
    (select count(*)::integer from organization.organization where id in('tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan') and status='active') organizations,
    (select count(*)::integer from identity.registrationpolicy where id=$2 and terms_hash=$3 and retired_at is null
      and effective_at<=clock_timestamp()) policies,
    (select count(*)::integer from access.role where id=$4 and scope_id=$5 and status='active') employee_roles,
    (select count(*)::integer from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id=$4 and mapping.effect='allow' and permission.code in(
        'catalog.listing.read','pricing.offer.read','inventory.read','cart.read','cart.manage','checkout.create','order.create',
        'order.read','order.aftersale.apply','payment.create','benefit.read','voucher.binding.read','support.case.create',
        'observability.clienterror.create')) employee_permissions,
    (select count(*)::integer from access.rolepermission where role_id=$4) employee_permission_mappings,
    (select count(*)::integer from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id=$4 and (mapping.effect<>'allow' or permission.status<>'active'
        or (permission.risk in('high','critical') and permission.code<>'payment.create'))) employee_risky_permissions,
    (select count(*)::integer from access.role where id='role:self' and scope_id='self' and status='active') self_roles,
    (select count(*)::integer from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role:self' and mapping.effect='allow'
        and permission.code in('identity.session.read','identity.session.manage')) self_permissions,
    (select count(*)::integer from member.invite where status='active'
      and (id='invite-demo-employee-2026' or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))) legacy_invites,
    (select count(*)::integer from access.membershiprole assignment join access.membership membership
      on membership.id=assignment.membership_id where assignment.role_id=$4
      and membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
      and (assignment.expires_at is null
        or assignment.expires_at>greatest(assignment.effective_at,'2026-08-28T00:00:00Z'::timestamptz))) legacy_employee_assignments,
    (select count(*)::integer from audit.record where id='audit:zhudatuan:registration-baseline:v1'
      and action='identity.registration.baseline.established') baseline_audits`,
    [REGISTRATION_BASELINE_VERSION, REGISTRATION_POLICY_ID, REGISTRATION_TERMS_HASH, REGISTRATION_ROLE_ID,
      REGISTRATION_ORGANIZATION_ID, sentinel]
  );
  const row = result.rows[0];
  if (
    !row ||
    row.database_name !== expectedDatabase ||
    row.database_role !== 'zhudatuanbootstrap' ||
    row.role_safe !== true ||
    row.sentinel_valid !== true ||
    row.schema_version !== REGISTRATION_BASELINE_VERSION ||
    row.organizations !== 3 ||
    row.policies !== 1 ||
    row.employee_roles !== 1 ||
    row.employee_permissions !== 14 ||
    row.employee_permission_mappings !== 14 ||
    row.employee_risky_permissions !== 0 ||
    row.self_roles !== 1 ||
    row.self_permissions !== 2 ||
    row.legacy_invites !== 0 ||
    row.legacy_employee_assignments !== 0 ||
    row.baseline_audits !== 1
  ) {
    throw new Error('REGISTRATION_BOOTSTRAP_DATABASE_BOUNDARY_INVALID');
  }
}

async function insertAuditRecord(database: Client, exported: RegistrationInvitationExport, actor: string): Promise<void> {
  const existing = await database.query(`select 1 from audit.record where id='audit:zhudatuan:registration-invite:v1'`);
  if (existing.rows[0]) throw new Error('REGISTRATION_BOOTSTRAP_AUDIT_CONFLICT');
  const previous = await database.query<{ record_hash: string }>(
    `select record_hash from(
    select record_hash,recorded_at occurred_at from audit.record where scope_id=$1
    union all select record_hash,accessed_at from audit.accessrecord where scope_id=$1
    union all select last_record_hash,through_at from audit.archiveref where scope_id=$1
  ) chain order by occurred_at desc limit 1`,
    [REGISTRATION_ORGANIZATION_ID]
  );
  const previousHash = previous.rows[0]?.record_hash ?? null;
  const afterHash = sha256(`${exported.invitationId}:${exported.tokenHash}:${exported.expiresAt}`);
  const recordHash = sha256(`audit:zhudatuan:registration-invite:v1:${previousHash ?? ''}:${afterHash}:${exported.createdAt}`);
  await database.query(
    `insert into audit.record(
    id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
    previous_hash,record_hash,recorded_at
  ) values('audit:zhudatuan:registration-invite:v1',$1,$2,'owner','identity.registration.invitation.bootstrapped',
    'member.invite',$3,null,$4,jsonb_build_object(
      'bootstrap','zhudatuan-registration-v1','policy',$5,'termsHash',$6,'maxUses',1,'expiresAt',$7::text,
      'tokenFingerprint',$8,'secretExportedOnce',true,'confirmation',$9::text
    ),'bootstrap:zhudatuan-registration-v1',$10,$11,$12)`,
    [
      REGISTRATION_ORGANIZATION_ID,
      actor,
      exported.invitationId,
      afterHash,
      REGISTRATION_POLICY_ID,
      REGISTRATION_TERMS_HASH,
      exported.expiresAt,
      exported.tokenHash,
      REGISTRATION_BOOTSTRAP_CONFIRMATION,
      previousHash,
      recordHash,
      exported.createdAt,
    ]
  );
}

async function assertAuditRecord(database: Client, exported: RegistrationInvitationExport, actor: string): Promise<void> {
  const audit = await database.query<{ count: number }>(
    `select count(*)::integer count from audit.record
    where id='audit:zhudatuan:registration-invite:v1' and scope_id=$1 and actor_id=$2
      and action='identity.registration.invitation.bootstrapped' and resource_id=$3
      and evidence->>'tokenFingerprint'=$4 and evidence->>'policy'=$5
      and evidence->>'secretExportedOnce'='true'`,
    [REGISTRATION_ORGANIZATION_ID, actor, exported.invitationId, exported.tokenHash, REGISTRATION_POLICY_ID]
  );
  if (audit.rows[0]?.count !== 1) throw new Error('REGISTRATION_BOOTSTRAP_AUDIT_INVALID');
}

async function prepareExport(outputPath: string, pendingPath: string, expiresInHours: number, identityKey: string): Promise<PreparedExport> {
  await assertSafeParent(outputPath);
  const final = await readSecureExport(outputPath, identityKey);
  const pending = await readSecureExport(pendingPath, identityKey);
  if (final && pending) {
    if (final.tokenHash !== pending.tokenHash) throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_COLLISION');
    return Object.freeze({ document: final, source: 'pending' });
  }
  if (final) return Object.freeze({ document: final, source: 'final' });
  if (pending) return Object.freeze({ document: pending, source: 'pending' });
  const document = createRegistrationInvitationExport(new Date(), expiresInHours, identityKey);
  const handle = await open(pendingPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8' });
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(pendingPath, 0o600);
  return Object.freeze({ document, source: 'pending' });
}

async function promoteExport(outputPath: string, pendingPath: string, source: 'final' | 'pending', identityKey: string): Promise<void> {
  if (source === 'pending') {
    try {
      await link(pendingPath, outputPath);
    } catch (cause) {
      if (!isNodeError(cause, 'EEXIST')) throw cause;
      const final = await readSecureExport(outputPath, identityKey);
      const pending = await readSecureExport(pendingPath, identityKey);
      if (!final || !pending || final.tokenHash !== pending.tokenHash) throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_PROMOTION_CONFLICT');
    }
    await unlink(pendingPath);
  }
  await chmod(outputPath, 0o600);
  await access(outputPath, constants.R_OK);
}

async function readSecureExport(path: string, identityKey: string): Promise<RegistrationInvitationExport | null> {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
      throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_PERMISSIONS_INVALID');
    }
    return parseRegistrationInvitationExport(await readFile(path, 'utf8'), identityKey);
  } catch (cause) {
    if (isNodeError(cause, 'ENOENT')) return null;
    throw cause;
  }
}

async function readSecret(endpoint: string, bearerToken: string, reference: string): Promise<string> {
  const response = await fetch(`${endpoint}/v1/secrets/${encodeURIComponent(reference)}`, {
    method: 'GET',headers: { accept: 'application/json', authorization: `Bearer ${bearerToken}` },
    redirect: 'error',signal: AbortSignal.timeout(5_000),
  });
  if (response.status!==200) throw new Error(`REGISTRATION_BOOTSTRAP_SECRET_READ_FAILED:${response.status}`);
  const body: unknown = await response.json();
  const value = body!==null && typeof body==='object' && !Array.isArray(body) ? Reflect.get(body,'value') : undefined;
  if (typeof value!=='string' || value.length<32) throw new Error('REGISTRATION_BOOTSTRAP_IDENTITY_KEY_INVALID');
  return value;
}

async function assertSafeParent(outputPath: string): Promise<void> {
  const parent = await lstat(dirname(outputPath));
  if (!parent.isDirectory() || parent.isSymbolicLink() || basename(outputPath).startsWith('.')) {
    throw new Error('REGISTRATION_BOOTSTRAP_OUTPUT_PARENT_INVALID');
  }
}

function isNodeError(value: unknown, code: string): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value && Reflect.get(value, 'code') === code;
}
