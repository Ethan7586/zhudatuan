import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface RegistrationMembership {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
  readonly organization: string;
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

export interface OperatorRegistrationMembership {
  readonly operatorMembership: string;
  readonly storefrontMembership: string;
  readonly member: string;
  readonly principal: string;
  readonly operatorOrganization: string;
  readonly storefrontOrganization: string;
  readonly operatorRole: string;
  readonly storefrontRole: string;
  readonly storefrontScopes: readonly [string, string, string];
  readonly operatorScopes: readonly [string, string];
}

export class AccessPort {
  async createRegistration(database: OperationDatabase, input: RegistrationMembership): Promise<Readonly<Record<string, unknown>>> {
    const membership = await database.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      values($1,$2,$3,'storefront','active',1,clock_timestamp()) returning *`, [input.membership, input.member, input.organization]);
    await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,$2,clock_timestamp()),($1,'role:self',clock_timestamp())`, [input.membership, input.role]);
    await database.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ($1,$2,$3,$4,$4,'allow',clock_timestamp(),1),($5,$2,'owner',$6,$6,'allow',clock_timestamp(),1),($7,$2,'self',$8,$8,'allow',clock_timestamp(),1)`,
    [input.scopes[0], input.membership, input.scopeKind, input.organization, input.scopes[1], input.member, input.scopes[2], `self:${input.principal}`]);
    const row = membership.rows[0];
    if (!row) throw new Error('MEMBERSHIP_CREATE_FAILED');
    return row;
  }

  async createOperatorRegistration(database: OperationDatabase, input: OperatorRegistrationMembership): Promise<Readonly<Record<string, unknown>>> {
    await this.createRegistration(database, {
      membership: input.storefrontMembership,
      member: input.member,
      principal: input.principal,
      organization: input.storefrontOrganization,
      role: input.storefrontRole,
      scopeKind: 'mall',
      scopes: input.storefrontScopes,
    });
    const membership = await database.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      values($1,$2,$3,'operator','active',1,clock_timestamp()) returning *`,
    [input.operatorMembership, input.member, input.operatorOrganization]);
    await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at) values
      ($1,$2,clock_timestamp()),($1,'role:self',clock_timestamp())`, [input.operatorMembership, input.operatorRole]);
    await database.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ($1,$2,'tenant',$3,$3,'allow',clock_timestamp(),1),($4,$2,'self',$5,$5,'allow',clock_timestamp(),1)`,
    [input.operatorScopes[0], input.operatorMembership, input.operatorOrganization, input.operatorScopes[1], `self:${input.principal}`]);
    const row = membership.rows[0];
    if (!row) throw new Error('MEMBERSHIP_CREATE_FAILED');
    return row;
  }

  async ensureImported(database: OperationDatabase, input: ImportedMembership): Promise<void> {
    await database.query(`insert into access.membership(id,member_id,organization_id,client,employee_no,status,access_version)
      values($1,$2,$3,$4,$5,'invited',1) on conflict(member_id,organization_id,client) do update set employee_no=excluded.employee_no`,
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
