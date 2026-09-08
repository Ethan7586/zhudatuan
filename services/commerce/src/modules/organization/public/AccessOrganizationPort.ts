import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface AccessOrganizationPort {
  invitationScope(context: ReadTransactionContext, organization: string): Promise<Readonly<{ id: string; kind: string }> | null>;
  delegationAllowed(context: ReadTransactionContext, input: Readonly<{ organization: string; allows: readonly string[]; denies: readonly string[] }>): Promise<boolean>;
  employeeDepartment(context: ReadTransactionContext, department: string, organization: string): Promise<Readonly<{ id: string; name: string }> | null>;
}

export const ACCESS_ORGANIZATION_PORT = publicPort<AccessOrganizationPort>('organization', 'access');
