import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface ImportedMembership {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
  readonly organization: string;
  readonly client: string;
  readonly employee: string;
}

export interface MemberImportAccessPort {
  ensureImported(context: WriteTransactionContext, input: ImportedMembership): Promise<void>;
}

export const MEMBER_IMPORT_ACCESS_PORT = publicPort<MemberImportAccessPort>('access', 'memberimport');
