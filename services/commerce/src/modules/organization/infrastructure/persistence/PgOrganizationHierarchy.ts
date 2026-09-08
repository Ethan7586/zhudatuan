import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrganizationHierarchyPort, OrganizationNode } from '../../public/HierarchyPort';
export class PgOrganizationHierarchy implements OrganizationHierarchyPort {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async descendants(context: ReadTransactionContext, scope: string): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      id: string;
    }>('select descendant_id id from organization.unitclosure where ancestor_id=$1 order by depth,descendant_id', [scope]);
    if (result.rows.length === 0) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze(result.rows.map(({ id }) => id));
  }
  async node(context: ReadTransactionContext, scope: string, lock = false): Promise<OrganizationNode> {
    const database = this.transactions.database(context);
    if (lock) {
      const found = await database.query<{
        id: string;
      }>('select id from organization.organization where id=$1 for key share', [scope]);
      if (!found.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    }
    const result = await database.query<{
      id: string;
      kind: string;
      timezone: string;
      tenant: string | null;
      ancestors: unknown;
      descendants: unknown;
    }>(
      `select target.id,target.kind,target.timezone,
       (select ancestor.id from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id
        where closure.descendant_id=target.id and ancestor.kind='tenant' order by closure.depth limit 1) tenant,
       (select jsonb_agg(ancestor_id order by depth) from organization.unitclosure where descendant_id=target.id and depth>0) ancestors,
       (select jsonb_agg(descendant_id order by depth,descendant_id) from organization.unitclosure where ancestor_id=target.id) descendants
       from organization.organization target where target.id=$1`,
      [scope]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ ...row, ancestors: strings(row.ancestors), descendants: strings(row.descendants) });
  }
}
function strings(value: unknown): readonly string[] {
  return Object.freeze(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []);
}
