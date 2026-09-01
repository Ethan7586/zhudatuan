import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface MemberSummary {
  readonly id: string;
  readonly displayName: string;
  readonly status: string;
  readonly version: number;
}
export interface MemberReadPort {
  summary(context: ReadTransactionContext, member: string): Promise<MemberSummary | null>;
}
export const MEMBER_READ_PORT = publicPort<MemberReadPort>('member', 'read');
