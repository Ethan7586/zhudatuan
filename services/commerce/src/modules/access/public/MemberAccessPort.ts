import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface MemberAccessPort {
  member(context: ReadTransactionContext, membership: string): Promise<string>;
  activeIn(context: ReadTransactionContext, member: string, organizations: readonly string[]): Promise<boolean>;
  members(context: ReadTransactionContext, organization: string, after: string | null, limit: number): Promise<readonly AccessMember[]>;
  profile(context: ReadTransactionContext, membership: string): Promise<AccessMember>;
}

export interface AccessMember {
  readonly id: string;
  readonly member: string;
  readonly organization: string;
  readonly employee: string | null;
  readonly status: string;
  readonly accessversion: number;
  readonly joinedat: Date | null;
}

export const MEMBER_ACCESS_PORT = publicPort<MemberAccessPort>('access', 'member');
