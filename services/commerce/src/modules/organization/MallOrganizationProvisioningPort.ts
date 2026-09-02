import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

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

export class MallOrganizationProvisioningPort {
  async conflict(database: OperationDatabase, input: MallOrganizationIdentity): Promise<MallOrganizationConflict | null> {
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))',
      [`mall:${input.scope}:${input.parent}:${input.code}`]);
    const parent = await database.query<{ id: string }>(`select parent.id from organization.organization root
      join organization.unitclosure visible on visible.ancestor_id=root.id
      join organization.organization parent on parent.id=visible.descendant_id
      where root.id=$1 and root.kind='platform' and root.status='active'
        and parent.id=$2 and parent.status='active' and (
          parent.kind='enterprise' or (parent.kind='mall' and exists(
            select 1 from organization.organization enterprise
            where enterprise.id=parent.parent_id and enterprise.kind='enterprise' and enterprise.status='active'
          ))
        )`, [input.scope, input.parent]);
    if (!parent.rows[0]) return 'MALL_PARENT_INVALID';
    const existing = await database.query(`select 1 from organization.organization mall
      join organization.sourcebinding binding on binding.organization_id=mall.id and binding.source_type='mall'
      where mall.parent_id=$1 and mall.kind='mall' and binding.source_code=$2 limit 1`, [input.parent, input.code]);
    return existing.rows[0] ? 'MALL_CODE_CONFLICT' : null;
  }

  async create(database: OperationDatabase, input: MallOrganization): Promise<void> {
    await database.query(`insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
      values($1,'mall',$2,$3,$4,'active',0,clock_timestamp(),clock_timestamp())`, [input.id, input.parent, input.name, input.timezone]);
    await database.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      select ancestor_id,$1,depth+1 from organization.unitclosure where descendant_id=$2 union all select $1,$1,0`, [input.id, input.parent]);
    await database.query(`insert into organization.sourcebinding(source_type,source_id,organization_id,source_code)
      values('mall',$1,$1,$2)`, [input.id, input.code]);
  }
}

export const mallOrganizationProvisioningPort = new MallOrganizationProvisioningPort();
