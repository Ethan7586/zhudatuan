import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface MemberAccessPort {
  member(context: ReadTransactionContext, membership: string): Promise<string>;
  activeIn(context: ReadTransactionContext, member: string, organizations: readonly string[]): Promise<boolean>;
  members(context: ReadTransactionContext, organization: string, actorMembership: string, after: string | null, limit: number): Promise<readonly AccessMember[]>;
  profile(context: ReadTransactionContext, membership: string): Promise<AccessMember>;
  syncProfile(context: WriteTransactionContext, profile: MemberProfileProjection): Promise<void>;
}

export interface MemberProfileProjection {
  readonly member: string;
  readonly displayName: string;
  readonly mobileMasked: string | null;
  readonly sourceVersion: number;
}

export interface AccessMember {
  readonly id: string;
  readonly member: string;
  readonly organization: string;
  readonly employee: string | null;
  readonly status: string;
  readonly accessversion: number;
  readonly joinedat: Date | null;
  readonly registrationresetallowed: boolean;
  readonly registrationresetblockreason: 'self' | 'protected' | 'inactive' | null;
}

export const MEMBER_ACCESS_PORT = publicPort<MemberAccessPort>('access', 'member');
