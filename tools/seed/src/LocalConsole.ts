import { createHmac } from 'node:crypto';
import type { Client } from 'pg';
import type { KmsClient } from '../../../services/commerce/src/pipeline/KmsPort';
import { syncMemberProjection } from './MemberProjection';
import { grantAudiencePermissions } from './RolePermissions';

export interface LocalConsoleAccount {
  readonly key: string;
  readonly principal: string;
  readonly member: string;
  readonly membership: string;
  readonly role: string;
  readonly subject: string;
  readonly mobile: string;
  readonly mobileMasked: string;
  readonly displayName: string;
  readonly employeeNo: string;
  readonly organization: string;
  readonly roleName: string;
  readonly permissions: 'console' | readonly string[];
  readonly scopes: readonly Readonly<{ kind: string; id: string; path: string }>[];
}

export async function ensureLocalConsoleAccount(
  database: Client,
  account: LocalConsoleAccount,
  security: Readonly<{ passwordHash: string; identityKey: string; kms: KmsClient }>
): Promise<void> {
  const subject = createHmac('sha256', security.identityKey).update(account.subject).digest('hex');
  const mobile = createHmac('sha256', security.identityKey).update(account.mobile).digest('hex');
  const envelope = await security.kms.encrypt('pii', 'identity/mobile', account.mobile, { principal: account.principal });
  await database.query(
    `insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values($1,'active',1,clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active',credential_version=identity.principal.credential_version+1,
      updated_at=clock_timestamp(),version=identity.principal.version+1`,
    [account.principal]
  );
  await database.query(
    `insert into member.profile(id,principal_id,display_name,mobile_ciphertext,mobile_token,mobile_masked,status,created_at,updated_at,version)
    values($1,$2,$3,$4,$5,$6,'active',clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set principal_id=excluded.principal_id,display_name=excluded.display_name,
      mobile_ciphertext=excluded.mobile_ciphertext,mobile_token=excluded.mobile_token,mobile_masked=excluded.mobile_masked,
      status='active',updated_at=clock_timestamp(),version=member.profile.version+1`,
    [account.member, account.principal, account.displayName, envelope.ciphertext, envelope.fingerprint, account.mobileMasked]
  );
  await syncMemberProjection(database, account.member);
  await database.query("delete from identity.credential where principal_id=$1 and provider in('password','otp')", [account.principal]);
  await database.query(
    `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at) values
      ('credential:password:'||$2||':v1',$1,'password',$3,$4,'active',clock_timestamp(),clock_timestamp()),
      ('credential:otp:'||$2||':v1',$1,'otp',$5,null,'active',null,clock_timestamp())`,
    [account.principal, account.key, subject, security.passwordHash, mobile]
  );
  await database.query(
    `insert into access.membership(id,member_id,principal_id,organization_id,client,employee_no,status,access_version,joined_at)
    values($1,$2,$3,$4,'operator',$5,'active',1,clock_timestamp())
    on conflict(id) do update set member_id=excluded.member_id,principal_id=excluded.principal_id,
      organization_id=excluded.organization_id,client='operator',employee_no=excluded.employee_no,status='active',left_at=null`,
    [account.membership, account.member, account.principal, account.organization, account.employeeNo]
  );
  await database.query(
    `insert into access.role(id,scope_id,name,status,version,kind)
    values($1,$2,$3,'active',0,'custom')
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active',kind='custom',version=access.role.version+1`,
    [account.role, account.organization, account.roleName]
  );
  await database.query('delete from access.rolepermission where role_id=$1', [account.role]);
  if (account.permissions === 'console') await grantAudiencePermissions(database, account.role, 'console');
  else {
    await database.query(
      `insert into access.rolepermission(role_id,permission_id,effect)
      select $1,permission.id,'allow' from access.permission permission
      where permission.status='active' and permission.code=any($2::text[])`,
      [account.role, account.permissions]
    );
  }
  await database.query('delete from access.membershiprole where membership_id=$1', [account.membership]);
  await database.query(
    `insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,$2,'1970-01-01T00:00:00Z'),($1,'role:self','1970-01-01T00:00:00Z')`,
    [account.membership, account.role]
  );
  await database.query('delete from access.scopegrant where membership_id=$1', [account.membership]);
  for (const scope of account.scopes) {
    await database.query(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
      values('scope:'||$1||':'||$2,$1,$2,$3,$4,'allow','1970-01-01T00:00:00Z',1)`,
      [account.membership, scope.kind, scope.id, scope.path]
    );
  }
}
