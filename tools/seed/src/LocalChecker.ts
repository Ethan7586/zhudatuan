import { createHmac } from 'node:crypto';
import type { Client } from 'pg';
import type { KmsClient } from '../../../services/commerce/src/foundation/infrastructure/KmsClient';
import { LOCAL_OWNER } from './LocalOwner';

export const LOCAL_CHECKER = Object.freeze({
  principal: 'principal:zhudatuan:checker:alice:v1',
  member: 'member:zhudatuan:checker:alice:v1',
  membership: 'membership-tenant-checker-alice-v1',
  role: 'role-tenant-checker-alice-v1',
  subject: 'alice',
  mobile: '+8613900139000',
});

export async function ensureLocalChecker(database: Client, input: Readonly<{ passwordHash: string; identityKey: string; kms: KmsClient }>): Promise<void> {
  const subject = createHmac('sha256', input.identityKey).update(LOCAL_CHECKER.subject).digest('hex');
  const mobile = createHmac('sha256', input.identityKey).update(LOCAL_CHECKER.mobile).digest('hex');
  const envelope = await input.kms.encrypt('pii', 'identity/mobile', LOCAL_CHECKER.mobile, { principal: LOCAL_CHECKER.principal });
  await database.query(
    `insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values($1,'active',1,clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active',credential_version=identity.principal.credential_version+1,updated_at=clock_timestamp(),version=identity.principal.version+1`,
    [LOCAL_CHECKER.principal]
  );
  await database.query(
    `insert into member.profile(id,principal_id,display_name,mobile_ciphertext,mobile_token,mobile_masked,status,created_at,updated_at,version)
    values($1,$2,'Alice', $3,$4,'139****9000','active',clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set principal_id=excluded.principal_id,display_name='Alice',mobile_ciphertext=excluded.mobile_ciphertext,
      mobile_token=excluded.mobile_token,mobile_masked=excluded.mobile_masked,status='active',updated_at=clock_timestamp(),version=member.profile.version+1`,
    [LOCAL_CHECKER.member, LOCAL_CHECKER.principal, envelope.ciphertext, envelope.fingerprint]
  );
  await database.query("delete from identity.credential where principal_id=$1 and provider in('password','otp')", [LOCAL_CHECKER.principal]);
  await database.query(
    `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at) values
      ('credential:password:zhudatuan-checker-alice:v1',$1,'password',$2,$3,'active',clock_timestamp(),clock_timestamp()),
      ('credential:otp:zhudatuan-checker-alice:v1',$1,'otp',$4,null,'active',null,clock_timestamp())`,
    [LOCAL_CHECKER.principal, subject, input.passwordHash, mobile]
  );
  await database.query(
    `insert into access.membership(id,member_id,principal_id,organization_id,client,employee_no,status,access_version,joined_at)
    values($1,$2,$3,$4,'operator','SW_LOCAL_ALICE','active',1,clock_timestamp())
    on conflict(id) do update set member_id=excluded.member_id,principal_id=excluded.principal_id,organization_id=excluded.organization_id,
      client='operator',employee_no=excluded.employee_no,status='active',left_at=null`,
    [LOCAL_CHECKER.membership, LOCAL_CHECKER.member, LOCAL_CHECKER.principal, LOCAL_OWNER.tenant]
  );
  await database.query(
    `insert into access.role(id,scope_id,name,status,version,kind)
    values($1,$2,'本地复核管理员','active',0,'custom')
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active',kind='custom',version=access.role.version+1`,
    [LOCAL_CHECKER.role, LOCAL_OWNER.tenant]
  );
  await database.query('delete from access.rolepermission where role_id=$1', [LOCAL_CHECKER.role]);
  await database.query(
    `insert into access.rolepermission(role_id,permission_id,effect)
    select distinct $1,permission.id,'allow' from capability.operation operation
    join access.permission permission on permission.code=operation.permission_code and permission.status='active'
    where operation.audience='console' on conflict do nothing`,
    [LOCAL_CHECKER.role]
  );
  await database.query("delete from access.membershiprole where membership_id=$1 and role_id in($2,'role:self')", [LOCAL_CHECKER.membership, LOCAL_CHECKER.role]);
  await database.query(
    `insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,$2,'1970-01-01T00:00:00Z'),($1,'role:self','1970-01-01T00:00:00Z')`,
    [LOCAL_CHECKER.membership, LOCAL_CHECKER.role]
  );
  const grants = [
    [LOCAL_CHECKER.membership, 'tenant', LOCAL_OWNER.tenant, LOCAL_OWNER.tenant],
    [LOCAL_CHECKER.membership, 'mall', LOCAL_OWNER.mall, `${LOCAL_OWNER.tenant}/${LOCAL_OWNER.mall}`],
    [LOCAL_CHECKER.membership, 'self', `self:${LOCAL_CHECKER.principal}`, `self:${LOCAL_CHECKER.principal}`],
  ] as const;
  for (const [membership, kind, scope, path] of grants) {
    await database.query(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
      values('scope:'||$1||':'||$2,$1,$2,$3,$4,'allow','1970-01-01T00:00:00Z',1)
      on conflict(membership_id,scope_kind,scope_id) do update set scope_path=excluded.scope_path,effect='allow',
        effective_at=excluded.effective_at,expires_at=null,access_version=excluded.access_version`,
      [membership, kind, scope, path]
    );
  }
}
