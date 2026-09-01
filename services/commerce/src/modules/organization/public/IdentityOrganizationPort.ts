import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface DirectoryMembershipBinding {
  readonly id: string;
  readonly name: string;
}
export interface IdentityOrganizationPort {
  kind(context: ReadTransactionContext, organization: string): Promise<string>;
  names(context: ReadTransactionContext, organizations: readonly string[]): Promise<readonly Readonly<{ id: string; name: string }>[]>;
  directoryBindings(context: ReadTransactionContext, provider: string, subjecthash: Buffer): Promise<readonly DirectoryMembershipBinding[]>;
}
export const IDENTITY_ORGANIZATION_PORT = publicPort<IdentityOrganizationPort>('organization', 'identity');
