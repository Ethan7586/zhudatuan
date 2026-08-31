import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface AccessOrganizationPort {
  invitationScope(database: OperationDatabase, organization: string): Promise<Readonly<{ id: string; kind: string }> | null>;
  delegationAllowed(database: OperationDatabase, input: Readonly<{ organization: string; allows: readonly string[]; denies: readonly string[] }>): Promise<boolean>;
}

export const ACCESS_ORGANIZATION_PORT = publicPort<AccessOrganizationPort>('organization', 'access');
