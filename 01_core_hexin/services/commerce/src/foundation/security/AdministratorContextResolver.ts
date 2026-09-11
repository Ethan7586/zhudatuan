import {
  ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION,
  type AdministratorContext,
  type AdministratorRoleKind,
  type AdminMemberSegment,
} from '@shop/config/sfl-node-kernel';
import type { QueryResult, QueryResultRow } from 'pg';
import type { Actor } from './AccessContext';

interface AdministratorContextRow {
  readonly administrator_identity_id: string;
  readonly administrator_identity_version: string | number;
  readonly active_membership_id: string;
  readonly account_id: string;
  readonly principal_id: string;
  readonly realm_id: string;
  readonly host_node_id: string;
  readonly role_kind: AdministratorRoleKind;
  readonly role_ids: string[];
  readonly permissions: string[];
  readonly scope_id: string;
  readonly scope_version: string | number;
  readonly line_id: string;
  readonly root_node_id: string;
  readonly segment: AdminMemberSegment;
  readonly access_version: string | number;
  readonly effective_at: Date | string;
}

export class PgAdministratorContextResolver {
  constructor(private readonly database: AdministratorContextDatabase) {}

  async resolve(actor: Actor): Promise<AdministratorContext> {
    if (actor.target !== 'console' || !actor.account || !actor.realm) {
      throw new Error('SFL_ADMINISTRATOR_IDENTITY_REQUIRED');
    }
    const result = await this.database.query<AdministratorContextRow>(
      'select * from access.resolve_administrator_context($1)', [actor.membership],
    );
    const row = result.rows[0];
    if (!row || result.rows.length !== 1) throw new Error('SFL_ADMINISTRATOR_IDENTITY_REQUIRED');
    const accessVersion = positiveVersion(row.access_version, 'SFL_ADMIN_ACCESS_VERSION_INVALID');
    if (row.active_membership_id !== actor.membership || row.account_id !== actor.account
      || row.principal_id !== actor.id || row.realm_id !== actor.realm
      || accessVersion !== actor.accessVersion) throw new Error('SFL_ADMINISTRATOR_CONTEXT_MISMATCH');
    return Object.freeze({
      administrator_identity_id: row.administrator_identity_id,
      administrator_identity_version: positiveVersion(row.administrator_identity_version, 'SFL_ADMIN_IDENTITY_VERSION_INVALID'),
      active_membership_id: row.active_membership_id,
      account_id: row.account_id,
      principal_id: row.principal_id,
      realm_id: row.realm_id,
      host_node_id: row.host_node_id,
      role_kind: row.role_kind,
      role_ids: Object.freeze([...row.role_ids]),
      permissions: Object.freeze([...row.permissions]),
      scope: Object.freeze({
        schema_version: ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION,
        scope_id: row.scope_id,
        scope_version: positiveVersion(row.scope_version, 'SFL_ADMIN_SCOPE_VERSION_INVALID'),
        realm_id: row.realm_id,
        line_id: row.line_id,
        root_node_id: row.root_node_id,
        segment: row.segment,
        access_version: accessVersion,
        effective_at: timestamp(row.effective_at),
      }),
    });
  }
}

export interface AdministratorContextDatabase {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

function positiveVersion(value: string | number, code: string): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error(code);
  return version;
}

function timestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('SFL_ADMIN_SCOPE_TIMESTAMP_INVALID');
  return date.toISOString();
}
