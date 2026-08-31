import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface IdentityAccessPort {
  memberships(database: OperationDatabase, member: string, target: 'console' | 'storefront'): Promise<readonly Readonly<{ id: string; target: 'console' | 'storefront'; organization: string; accessVersion: number }>[]>;
  session(database: OperationDatabase, membership: string, target: 'console' | 'storefront'): Promise<Readonly<{ accessVersion: number; client: 'console' | 'storefront' }>>;
  directoryMemberships(database: OperationDatabase, memberships: readonly string[]): Promise<Readonly<{ principal: string | null; memberships: readonly Readonly<{ id: string; target: 'console' | 'storefront' }>[]; conflict: boolean }>>;
  setEmployeeNumber(database: OperationDatabase, membership: string, employee: string | null): Promise<void>;
  memberForManagement(database: OperationDatabase, membership: string): Promise<Readonly<{ member: string; accessVersion: number }>>;
  changeStatus(database: OperationDatabase, membership: string, status: 'active' | 'suspended' | 'left'): Promise<Readonly<{ accessVersion: number }>>;
  replaceDepartment(database: OperationDatabase, input: Readonly<{ membership: string; department: string; path: string; grant: string }>): Promise<void>;
  applyDirectoryLifecycle(
    database: OperationDatabase,
    input: Readonly<{ membership: string; status: 'active' | 'suspended' | 'left'; department: string | null; grant: string; scope: string; trace: string; reason: 'directoryfreeze' | 'directoryrestore' | 'directoryupdate' }>
  ): Promise<number>;
}

export const IDENTITY_ACCESS_PORT = publicPort<IdentityAccessPort>('access', 'identity');
