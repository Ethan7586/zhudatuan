import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OrganizationReadPort, OrganizationScopeSnapshot } from '../../public/OrganizationReadPort';
export class PgOrganizationReadPort implements OrganizationReadPort {
  private readonly transactions = new PgTransactionAccess();
  async summaries(context: ReadTransactionContext, ids: readonly string[]): Promise<readonly { id: string; name: string; kind: string }[]> {
    if (ids.length === 0) return Object.freeze([]);
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; name: string; kind: string }>(
      `select id,name,kind from organization.organization where id=any($1::text[]) order by name,id`,
      [ids]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async activeMalls(context: ReadTransactionContext, scopeId: string): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
    }>(
      `select mall.id from organization.unitclosure closure
      join organization.organization mall on mall.id=closure.descendant_id and mall.kind='mall' and mall.status='active'
      where closure.ancestor_id=$1 order by mall.id`,
      [scopeId]
    );
    return Object.freeze(result.rows.map(({ id }) => id));
  }
  async descendants(context: ReadTransactionContext, scopeId: string): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
    }>(`select descendant_id id from organization.unitclosure where ancestor_id=$1 order by depth,descendant_id`, [scopeId]);
    if (result.rows.length === 0) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze(result.rows.map(({ id }) => id));
  }
  async scope(context: ReadTransactionContext, scopeId: string, lock = false): Promise<OrganizationScopeSnapshot> {
    const database = this.transactions.database(context);
    if (lock) {
      const locked = await database.query<{
        id: string;
      }>('select id from organization.organization where id=$1 for key share', [scopeId]);
      if (!locked.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    }
    const result = await database.query<{
      id: string;
      scope_kind: string;
      timezone: string;
      tenant: string | null;
      ancestors: unknown;
      descendants: unknown;
    }>(
      `select target.id,target.kind scope_kind,target.timezone,
      (select ancestor.id from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id
        where closure.descendant_id=target.id and ancestor.kind='tenant' order by closure.depth limit 1) tenant,
      (select jsonb_agg(ancestor_id order by depth) from organization.unitclosure where descendant_id=target.id and depth>0) ancestors,
      (select jsonb_agg(descendant_id order by depth,descendant_id) from organization.unitclosure where ancestor_id=target.id) descendants
      from organization.organization target where target.id=$1`,
      [scopeId]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    const ancestors = strings(row.ancestors);
    const descendants = strings(row.descendants);
    return Object.freeze({ id: row.id, scopeKind: row.scope_kind, timezone: row.timezone, tenant: row.tenant, ancestors: Object.freeze(ancestors), descendants: Object.freeze(descendants) });
  }
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}
