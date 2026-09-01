import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface IdentityAccessPort {
  memberships(context: ReadTransactionContext, member: string, target: 'console' | 'storefront'): Promise<readonly Readonly<{ id: string; target: 'console' | 'storefront'; organization: string; accessVersion: number }>[]>;
  session(context: WriteTransactionContext, membership: string, target: 'console' | 'storefront'): Promise<Readonly<{ accessVersion: number; client: 'console' | 'storefront' }>>;
  directoryMemberships(context: ReadTransactionContext, memberships: readonly string[]): Promise<Readonly<{ principal: string | null; memberships: readonly Readonly<{ id: string; target: 'console' | 'storefront' }>[]; conflict: boolean }>>;
  setEmployeeNumber(context: WriteTransactionContext, membership: string, employee: string | null): Promise<void>;
  memberForManagement(context: WriteTransactionContext, membership: string): Promise<Readonly<{ member: string; accessVersion: number }>>;
  changeStatus(context: WriteTransactionContext, membership: string, status: 'active' | 'suspended' | 'left'): Promise<Readonly<{ accessVersion: number }>>;
  replaceDepartment(context: WriteTransactionContext, input: Readonly<{ membership: string; department: string; path: string; grant: string }>): Promise<void>;
  applyDirectoryLifecycle(
    context: WriteTransactionContext,
    input: Readonly<{ membership: string; status: 'active' | 'suspended' | 'left'; department: string | null; grant: string; scope: string; trace: string; reason: 'directoryfreeze' | 'directoryrestore' | 'directoryupdate' }>
  ): Promise<number>;
}

export const IDENTITY_ACCESS_PORT = publicPort<IdentityAccessPort>('access', 'identity');
