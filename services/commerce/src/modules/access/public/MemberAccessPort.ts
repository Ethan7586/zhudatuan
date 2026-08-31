import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface MemberAccessPort {
  member(database: OperationDatabase, membership: string): Promise<string>;
  activeIn(database: OperationDatabase, member: string, organizations: readonly string[]): Promise<boolean>;
  members(database: OperationDatabase, organization: string, after: string | null, limit: number): Promise<readonly AccessMember[]>;
  profile(database: OperationDatabase, membership: string): Promise<AccessMember>;
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
