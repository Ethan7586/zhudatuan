import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

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

export const organizationPort = new OrganizationPort();
