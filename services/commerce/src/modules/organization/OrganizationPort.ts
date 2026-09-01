import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export class OrganizationPort {
  async kind(database: OperationDatabase, organization: string): Promise<string> {
    const result = await database.query<{ kind: string }>(`select kind from organization.organization where id=$1 and status='active'`, [organization]);
    const kind = result.rows[0]?.kind;
    if (!kind) throw new Error('ORGANIZATION_NOT_FOUND');
    return kind;
  }

  async createDistributor(database: OperationDatabase, input: Readonly<{ id: string; parent: string; name: string; timezone: string }>): Promise<void> {
    const parent = await database.query<{ id: string }>(`select id from organization.organization
      where id=$1 and kind='platform' and status='active' for update`, [input.parent]);
    if (!parent.rows[0]) throw new Error('DISTRIBUTOR_PARENT_INVALID');
    await database.query(`insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
      values($1,'distributor',$2,$3,$4,'active',0,clock_timestamp(),clock_timestamp())`,
    [input.id, input.parent, input.name, input.timezone]);
    await database.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      select ancestor_id,$1,depth+1 from organization.unitclosure where descendant_id=$2 union all select $1,$1,0`, [input.id, input.parent]);
  }

  async mallConflict(database: OperationDatabase, input: MallOrganizationIdentity): Promise<MallOrganizationConflict | null> {
    const parent = await database.query<{ id: string }>(`select parent.id from organization.organization root
      join organization.unitclosure visible on visible.ancestor_id=root.id
      join organization.organization parent on parent.id=visible.descendant_id
      where root.id=$1 and root.kind='platform' and root.status='active'
        and parent.id=$2 and parent.kind='enterprise' and parent.status='active'
      for update of root,parent`, [input.scope, input.parent]);
    if (!parent.rows[0]) return 'MALL_PARENT_INVALID';
    const existing = await database.query(`select 1 from organization.organization mall
      join organization.sourcebinding binding on binding.organization_id=mall.id and binding.source_type='mall'
      where mall.parent_id=$1 and mall.kind='mall' and binding.source_code=$2 limit 1`, [input.parent, input.code]);
    return existing.rows[0] ? 'MALL_CODE_CONFLICT' : null;
  }

  async createMall(database: OperationDatabase, input: MallOrganization): Promise<void> {
    await database.query(`insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
      values($1,'mall',$2,$3,$4,'active',0,clock_timestamp(),clock_timestamp())`, [input.id, input.parent, input.name, input.timezone]);
    await database.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      select ancestor_id,$1,depth+1 from organization.unitclosure where descendant_id=$2 union all select $1,$1,0`, [input.id, input.parent]);
    await database.query(`insert into organization.sourcebinding(source_type,source_id,organization_id,source_code)
      values('mall',$1,$1,$2)`, [input.id, input.code]);
  }

  async rename(database: OperationDatabase, id: string, name: string): Promise<void> {
    const changed = await database.query(`update organization.organization set name=$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`, [id, name]);
    if (!changed.rows[0]) throw new Error('ORGANIZATION_NOT_FOUND');
  }

  async disable(database: OperationDatabase, id: string): Promise<void> {
    const changed = await database.query(`update organization.organization set status='disabled',version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`, [id]);
    if (!changed.rows[0]) throw new Error('ORGANIZATION_NOT_FOUND');
  }
}

export interface MallOrganizationIdentity {
  readonly scope: string;
  readonly parent: string;
  readonly code: string;
}

export interface MallOrganization extends MallOrganizationIdentity {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
}

export type MallOrganizationConflict = 'MALL_PARENT_INVALID' | 'MALL_CODE_CONFLICT';

export const organizationPort = new OrganizationPort();
