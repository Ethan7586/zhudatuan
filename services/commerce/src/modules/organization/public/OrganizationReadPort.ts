import { publicPort } from '../../../bootstrap/ModuleRegistry';
import { DomainError } from '../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface OrganizationReadPort {
  descendants(database: OperationDatabase, scopeId: string): Promise<readonly string[]>;
  activeMalls(database: OperationDatabase, scopeId: string): Promise<readonly string[]>;
  scope(database: OperationDatabase, scopeId: string, lock?: boolean): Promise<OrganizationScopeSnapshot>;
}

export interface OrganizationScopeSnapshot {
  readonly id: string;
  readonly scopeKind: string;
  readonly timezone: string;
  readonly tenant: string | null;
  readonly ancestors: readonly string[];
  readonly descendants: readonly string[];
}

export const ORGANIZATION_READ_PORT = publicPort<OrganizationReadPort>('organization', 'read');

export class PgOrganizationReadPort implements OrganizationReadPort {
  async activeMalls(database: OperationDatabase, scopeId: string): Promise<readonly string[]> {
    const result = await database.query<{ id: string }>(
      `select mall.id from organization.unitclosure closure
      join organization.organization mall on mall.id=closure.descendant_id and mall.kind='mall' and mall.status='active'
      where closure.ancestor_id=$1 order by mall.id`,
      [scopeId]
    );
    return Object.freeze(result.rows.map(({ id }) => id));
  }

  async descendants(database: OperationDatabase, scopeId: string): Promise<readonly string[]> {
    const result = await database.query<{ id: string }>(`select descendant_id id from organization.unitclosure where ancestor_id=$1 order by depth,descendant_id`, [scopeId]);
    if (result.rows.length === 0) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze(result.rows.map(({ id }) => id));
  }

  async scope(database: OperationDatabase, scopeId: string, lock = false): Promise<OrganizationScopeSnapshot> {
    if (lock) {
      const locked = await database.query<{ id: string }>('select id from organization.organization where id=$1 for key share', [scopeId]);
      if (!locked.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    }
    const result = await database.query<{ id: string; scope_kind: string; timezone: string; tenant: string | null; ancestors: unknown; descendants: unknown }>(
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
