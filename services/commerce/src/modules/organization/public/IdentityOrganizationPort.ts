import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface DirectoryMembershipBinding {
  readonly id: string;
  readonly name: string;
}
export interface IdentityOrganizationPort {
  kind(database: OperationDatabase, organization: string): Promise<string>;
  names(database: OperationDatabase, organizations: readonly string[]): Promise<readonly Readonly<{ id: string; name: string }>[]>;
  directoryBindings(database: OperationDatabase, provider: string, subjecthash: Buffer): Promise<readonly DirectoryMembershipBinding[]>;
}
export const IDENTITY_ORGANIZATION_PORT = publicPort<IdentityOrganizationPort>('organization', 'identity');
