import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { IdentityPrincipal } from '../../identity';
import type { AccessPort } from '../../access';
import { memberPort } from '../MemberPort';

export async function importMember(database: OperationDatabase, identities: IdentityPrincipal, access: AccessPort, organization: string,
  row: Readonly<Record<string, string>>): Promise<void> {
  const display = required(row.displayName, 'DISPLAY_NAME_REQUIRED', 128);
  const employee = required(row.employeeNo, 'EMPLOYEE_NUMBER_REQUIRED', 128);
  const client = row.client || 'storefront';
  if (!['storefront', 'operator', 'store', 'supplier'].includes(client)) throw new Error('MEMBER_CLIENT_INVALID');
  const key = createHash('sha256').update(`${organization}:${employee}`).digest('hex');
  const principal = `principal:import:${key}`;
  const member = `member:import:${key}`;
  const membership = `membership:import:${key}:${client}`;
  await identities.ensurePending(database, principal);
  await memberPort.ensureImported(database, { member, principal, display, status: 'pending' });
  await access.ensureImported(database, { membership, member, organization, client, employee });
}

function required(value: string | undefined, code: string, maximum: number): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}
