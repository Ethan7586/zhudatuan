import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface AccessOrganizationPort {
  invitationScope(context: ReadTransactionContext, organization: string): Promise<Readonly<{ id: string; kind: string }> | null>;
  delegationAllowed(context: ReadTransactionContext, input: Readonly<{ organization: string; allows: readonly string[]; denies: readonly string[] }>): Promise<boolean>;
}

export const ACCESS_ORGANIZATION_PORT = publicPort<AccessOrganizationPort>('organization', 'access');
