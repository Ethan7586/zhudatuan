import type { OperationId } from '@shop/contract';
import {
  ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION,
  parseAdministratorScopeChangeRequest,
} from '@shop/config/sfl-node-kernel';
import { requireAccess, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { PgAdministratorContextResolver } from '../../../foundation/security/AdministratorContextResolver';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../foundation/interface/Validation';

export const ADMINISTRATOR_SEGMENT_READ_OPERATION_IDS = Object.freeze([
  'access.administrators.members.read',
  'access.administrators.member.read',
] as const satisfies readonly OperationId[]);

export function administratorSegmentReadActions(): OperationActions {
  return {
    'access.administrators.members.read': async (request, database) => {
      const access = requireAccess(request);
      const administrator = await new PgAdministratorContextResolver(database).resolve(access.actor);
      const page = queryPage(request, 500);
      const result = await database.query('select * from access.list_administrator_members($1,$2,$3)',
        [administrator.active_membership_id, page.id, page.fetch]);
      return keysetResult(result, page, 'node_id', 'node_id');
    },
    'access.administrators.member.read': async (request, database) => {
      const access = requireAccess(request);
      const administrator = await new PgAdministratorContextResolver(database).resolve(access.actor);
      const result = await database.query('select * from access.read_administrator_member($1,$2)',
        [administrator.active_membership_id, request.input.path.nodeid!]);
      const member = result.rows[0];
      if (!member) throw new Error('SFL_ADMIN_MEMBER_NOT_FOUND');
      return { status: 200, body: member };
    },
  };
}

export function administratorSegmentWriteActions(): OperationActions {
  return {
    'access.administrators.scopes.manage': async (request, database) => {
      const access = requireAccess(request);
      const actor = await new PgAdministratorContextResolver(database).resolve(access.actor);
      const expectedVersion = request.input.expectedVersion;
      if (expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
      const change = parseAdministratorScopeChangeRequest(bodyRecord(request));
      const result = await database.query(`select * from access.change_administrator_segment_scope($1,$2,$3,$4::jsonb)`, [
        actor.active_membership_id,
        request.input.path.membershipid!,
        expectedVersion,
        JSON.stringify({ ...change, idempotency_key: request.input.idempotency, trace_id: access.trace }),
      ]);
      const row = result.rows[0] as Readonly<Record<string, unknown>> | undefined;
      if (!row) throw new Error('SFL_ADMIN_SCOPE_CHANGE_FAILED');
      return { status: 200, body: Object.freeze({
        business_number: row.business_number,
        administrator_identity_id: row.administrator_identity_id,
        administrator_membership_id: row.administrator_membership_id,
        role_id: row.role_id,
        action: row.action,
        scope: row.scope_id === null ? null : Object.freeze({
          schema_version: ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION,
          scope_id: row.scope_id,
          scope_version: Number(row.scope_version),
          realm_id: row.realm_id,
          line_id: row.line_id,
          root_node_id: row.root_node_id,
          segment: row.segment,
          access_version: Number(row.access_version),
          effective_at: timestamp(row.effective_at),
        }),
        access_version: Number(row.access_version),
        replayed: row.replayed,
      }) };
    },
    'access.administrators.members.note': async (request, database) => {
      const access = requireAccess(request);
      const administrator = await new PgAdministratorContextResolver(database).resolve(access.actor);
      const note = textField(bodyRecord(request), 'note').trim();
      if (note.length === 0 || note.length > 2_000) throw new Error('VALIDATION_FAILED:note');
      const result = await database.query(`select * from access.record_administrator_member_note($1,$2,$3,$4,$5,$6,$7)`, [
        administrator.active_membership_id,
        administrator.administrator_identity_id,
        administrator.scope.scope_version,
        request.input.path.nodeid!,
        request.input.idempotency!,
        note,
        access.trace,
      ]);
      const row = result.rows[0];
      if (!row) throw new Error('SFL_ADMIN_MEMBER_WRITE_FAILED');
      return { status: 201, body: row };
    },
  };
}

function timestamp(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error('SFL_ADMIN_SCOPE_TIMESTAMP_INVALID');
  return date.toISOString();
}
