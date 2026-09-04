import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface MemberSummary {
  readonly id: string;
  readonly displayName: string;
  readonly employeeNo: string | null;
  readonly mobileMasked: string | null;
  readonly status: string;
  readonly version: number;
}
export interface PrincipalSummary {
  readonly principal: string;
  readonly displayName: string;
  readonly mobileMasked: string | null;
}
export interface MemberProfileLabel {
  readonly member: string;
  readonly displayName: string;
  readonly mobileMasked: string | null;
}
export interface MemberReadPort {
  summary(context: ReadTransactionContext, member: string, scope: string): Promise<MemberSummary | null>;
  principals(context: ReadTransactionContext, principals: readonly string[], scope: string): Promise<readonly PrincipalSummary[]>;
  profiles(context: ReadTransactionContext, members: readonly string[]): Promise<readonly MemberProfileLabel[]>;
}
export const MEMBER_READ_PORT = publicPort<MemberReadPort>('member', 'read');
