import { requireAccess, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { canonicalScope, numericVersion, requireExpectedVersion } from './AccessOperationValues';

export async function offboardAdministrator(request: OperationRequest, database: OperationDatabase,
  access: ReturnType<typeof requireAccess>): Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>> {
  const actorLevel = access.governance?.governanceLevel;
  if (actorLevel !== 'owner' && actorLevel !== 'senior_administrator') {
    throw new Error('OWNER_REQUIRED_FOR_ADMINISTRATOR_OFFBOARDING');
  }
  const membership = textField(bodyRecord(request), 'membership');
  const expectedVersion = requireExpectedVersion(request);
  const changed = (await database.query<{ access_version: string | number }>(
    `select access.offboard_administrator($1,$2,$3,$4,$5) access_version`,
    [access.membership.id, membership, access.scope.kind, access.scope.id, expectedVersion],
  )).rows[0];
  if (changed === undefined) throw new Error('VERSION_CONFLICT');
  return { status: 200, body: Object.freeze({ action: 'offboard', changed: true, membership,
    status: 'offboarded', access_version: numericVersion(changed.access_version) }) };
}

export async function demoteAdministrator(request: OperationRequest, database: OperationDatabase,
  access: ReturnType<typeof requireAccess>, role: string): Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>> {
  if (!role.startsWith('role-senior-administrator-v1:')) throw new Error('ROLE_ASSIGNMENT_NOT_AVAILABLE');
  const body = bodyRecord(request);
  const membership = textField(body, 'membership');
  const kind = textField(body, 'kind');
  const scope = textField(body, 'scope');
  const source = textField(body, 'scopeSource');
  if (source !== 'direct' && source !== 'inherited') throw new Error('VALIDATION_FAILED:scopeSource');
  const changed = (await database.query<{ access_version: string | number; scope: unknown }>(
    `select access.demote_administrator($1,$2,$3,$4,$5,$6) access_version,
      access.scope_object($7) scope`,
    [access.membership.id, membership, role, access.scope.kind, access.scope.id,
      requireExpectedVersion(request), scope],
  )).rows[0];
  if (changed === undefined) throw new Error('VERSION_CONFLICT');
  const targetScope = canonicalScope(changed.scope);
  if (targetScope === null || targetScope.kind !== kind) throw new Error('VALIDATION_FAILED:scope');
  return { status: 200, body: Object.freeze({ action: 'revoke', changed: true, role, membership,
    scope: targetScope, scope_source: source, access_version: numericVersion(changed.access_version) }) };
}
