import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface RegistrationMembership {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
  readonly organization: string;
  readonly realm: string;
  readonly account: string;
  readonly employee?: string | null;
  readonly role: string;
  readonly scopeKind: string;
  readonly scopes: readonly [string, string, string];
}

export interface ImportedMembership {
  readonly membership: string;
  readonly member: string;
  readonly organization: string;
  readonly client: string;
  readonly employee: string;
}

export interface InvitedRegistrationMembership {
  readonly storefrontMembership: string;
  readonly operatorMembership: string;
  readonly member: string;
  readonly principal: string;
  readonly organization: string;
  readonly storefrontRole: string;
  readonly operatorRole: string;
  readonly scopeKind: string;
  readonly scopes: readonly [string, string, string, string, string, string];
}

export class AccessPort {
  async createRegistration(database: OperationDatabase, input: RegistrationMembership): Promise<Readonly<Record<string, unknown>>> {
    const membership = await database.query(`insert into access.membership(
      id,member_id,organization_id,client,status,access_version,joined_at,employee_no,realm_id,account_id,node_profile)
      select $1,$2,$3,'storefront','active',1,transaction_timestamp(),$4,realm.id,$6,realm.node_profile
      from identity.realm realm where realm.id=$5 and realm.status='active' returning *`,
    [input.membership, input.member, input.organization, input.employee ?? null, input.realm, input.account]);
    await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,$2,transaction_timestamp()),($1,'role:self',transaction_timestamp())`, [input.membership, input.role]);
    await database.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ($1,$2,$3,$4,$4,'allow',transaction_timestamp(),1),($5,$2,'owner',$6,$6,'allow',transaction_timestamp(),1),($7,$2,'self',$8,$8,'allow',transaction_timestamp(),1)`,
    [input.scopes[0], input.membership, input.scopeKind, input.organization, input.scopes[1], input.member, input.scopes[2], `self:${input.principal}`]);
    const row = membership.rows[0];
    if (!row) throw new Error('MEMBERSHIP_CREATE_FAILED');
    return row;
  }

  async createInvitedRegistration(database: OperationDatabase, input: InvitedRegistrationMembership): Promise<Readonly<Record<string, unknown>>> {
    const storefront = await database.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      values($1,$2,$3,'storefront','active',1,transaction_timestamp()) returning *`,
    [input.storefrontMembership, input.member, input.organization]);
    await database.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      values($1,$2,$3,'operator','active',1,transaction_timestamp())`,
    [input.operatorMembership, input.member, input.organization]);
    await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,$2,transaction_timestamp()),($1,'role:self',transaction_timestamp()),
      ($3,$4,transaction_timestamp()),($3,'role:self',transaction_timestamp()) on conflict do nothing`,
    [input.storefrontMembership, input.storefrontRole, input.operatorMembership, input.operatorRole]);
    const selfScope = `self:${input.principal}`;
    await database.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ($1,$7,$8,$9,$9,'allow',transaction_timestamp(),1),($2,$7,'owner',$10,$10,'allow',transaction_timestamp(),1),
      ($3,$7,'self',$11,$11,'allow',transaction_timestamp(),1),($4,$12,$8,$9,$9,'allow',transaction_timestamp(),1),
      ($5,$12,'owner',$10,$10,'allow',transaction_timestamp(),1),($6,$12,'self',$11,$11,'allow',transaction_timestamp(),1)`,
    [...input.scopes, input.storefrontMembership, input.scopeKind, input.organization, input.member, selfScope, input.operatorMembership]);
    const row = storefront.rows[0];
    if (!row) throw new Error('MEMBERSHIP_CREATE_FAILED');
    return row;
  }

  async ensureImported(database: OperationDatabase, input: ImportedMembership): Promise<void> {
    await database.query('select access.ensure_imported_membership($1,$2,$3,$4,$5)',
      [input.membership, input.member, input.organization, input.client, input.employee]);
  }

  async member(database: OperationDatabase, membership: string): Promise<string> {
    const owner = await database.query<{ member_id: string }>(`select member_id from access.membership where id=$1 and status='active'`, [membership]);
    if (!owner.rows[0]) throw new Error('MEMBERSHIP_NOT_FOUND');
    return owner.rows[0].member_id;
  }

  async revokeSessions(database: OperationDatabase, membership: string): Promise<void> {
    await database.query(`update access.membership set access_version=access_version+1 where id=$1`, [membership]);
  }

}

export const accessPort = new AccessPort();
