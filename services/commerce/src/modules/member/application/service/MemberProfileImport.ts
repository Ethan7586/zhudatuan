import { createHash } from 'node:crypto';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { IdentityPrincipal } from '../../../identity/public/index';
import type { MemberImportAccessPort } from '../../../access/public/index';

export interface MemberProfileWriter {
  ensureImported(context: WriteTransactionContext, input: Readonly<{ member: string; principal: string; display: string; status: 'active' | 'pending' }>): Promise<void>;
}

export async function importMember(context: WriteTransactionContext, identities: IdentityPrincipal, access: MemberImportAccessPort, members: MemberProfileWriter, organization: string, row: Readonly<Record<string, string>>): Promise<void> {
  const display = required(row.displayName, 'DISPLAY_NAME_REQUIRED', 128);
  const employee = required(row.employeeNo, 'EMPLOYEE_NUMBER_REQUIRED', 128);
  const client = row.client || 'storefront';
  if (!['storefront', 'operator', 'store', 'supplier'].includes(client)) throw new Error('MEMBER_CLIENT_INVALID');
  const key = createHash('sha256').update(`${organization}:${employee}`).digest('hex');
  const principal = `principal:import:${key}`;
  const member = `member:import:${key}`;
  const membership = `membership:import:${key}:${client}`;
  await identities.ensurePending(context, principal);
  await members.ensureImported(context, { member, principal, display, status: 'pending' });
  await access.ensureImported(context, { membership, member, principal, organization, client, employee });
}

function required(value: string | undefined, code: string, maximum: number): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}
