import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import type { ApprovalInstanceRecord } from './ApprovalRecord';

export interface ApprovalReadPort {
  read(context: ReadTransactionContext, scopeId: string, instanceId: string): Promise<ApprovalInstanceRecord | null>;
}

export const APPROVAL_READ_PORT = publicPort<ApprovalReadPort>('approval', 'approvalread');
