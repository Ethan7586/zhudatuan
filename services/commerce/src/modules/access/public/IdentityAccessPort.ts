import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';

import { publicPort } from '../../../composition/ModuleRegistry';

export interface IdentityMembership {
  readonly id: string;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly organization: string;
  readonly accessVersion: number;
  readonly displayName: string;
  readonly organizationName: string;
  readonly scopeKind: string;
  readonly scopeId: string;
  readonly roleLabel: string;
  readonly logoUrl: string | null;
}

export interface IdentityAccessPort {
  memberships(context: ReadTransactionContext, member: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<readonly IdentityMembership[]>;
  session(
    context: WriteTransactionContext,
    membership: string,
    target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'
  ): Promise<Readonly<{ accessVersion: number; client: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier' }>>;
  directoryMemberships(context: ReadTransactionContext, memberships: readonly string[]): Promise<Readonly<{ principal: string | null; memberships: readonly IdentityMembership[]; conflict: boolean }>>;
  setEmployeeNumber(context: WriteTransactionContext, membership: string, employee: string | null): Promise<void>;
  memberForManagement(context: WriteTransactionContext, membership: string): Promise<Readonly<{ member: string; accessVersion: number }>>;
  resetRegistrations(context: WriteTransactionContext, input: Readonly<{ member: string; actorMembership: string; trace: string }>): Promise<Readonly<{ memberships: readonly string[]; accessVersion: number }>>;
  changeStatus(context: WriteTransactionContext, membership: string, status: 'active' | 'suspended' | 'left'): Promise<Readonly<{ accessVersion: number }>>;
  replaceDepartment(context: WriteTransactionContext, input: Readonly<{ membership: string; department: string; path: string; grant: string }>): Promise<void>;
  applyDirectoryLifecycle(
    context: WriteTransactionContext,
    input: Readonly<{ membership: string; status: 'active' | 'suspended' | 'left'; department: string | null; grant: string; scope: string; trace: string; reason: 'directoryfreeze' | 'directoryrestore' | 'directoryupdate' }>
  ): Promise<number>;
}

export const IDENTITY_ACCESS_PORT = publicPort<IdentityAccessPort>('access', 'identity');
