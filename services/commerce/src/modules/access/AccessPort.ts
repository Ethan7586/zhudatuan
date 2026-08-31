import { DomainError } from '../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { IdentityAccessPort } from './public/IdentityAccessPort';
import type { ImportedMembership, MemberImportAccessPort } from './public/MemberImportAccessPort';
import type { AccessVersionService } from './application/service/AccessVersionService';
import type { AccessMember, MemberAccessPort } from './public/MemberAccessPort';
import type { AccessRepository } from './application/port/AccessRepository';

export class AccessPort implements IdentityAccessPort, MemberAccessPort, MemberImportAccessPort {
  constructor(
    private readonly repository: AccessRepository,
    private readonly versions: AccessVersionService
  ) {}
  async memberships(database: OperationDatabase, member: string, target: 'console' | 'storefront'): Promise<readonly Readonly<{ id: string; target: 'console' | 'storefront'; organization: string; accessVersion: number }>[]> {
    const result = await this.repository.activeMemberships(database, member, target);
    return Object.freeze(result.map(({ id, client, organization, accessVersion }) => Object.freeze({ id, target: client, organization, accessVersion })));
  }

  async session(database: OperationDatabase, membership: string, target: 'console' | 'storefront'): Promise<Readonly<{ accessVersion: number; client: 'console' | 'storefront' }>> {
    const accessVersion = await this.repository.lockSession(database, membership, target);
    if (accessVersion === null) throw new DomainError('MEMBERSHIP_SELECTION_REQUIRED');
    return Object.freeze({ accessVersion, client: target });
  }

  async directoryMemberships(
    database: OperationDatabase,
    memberships: readonly string[]
  ): Promise<Readonly<{ principal: string | null; memberships: readonly Readonly<{ id: string; target: 'console' | 'storefront' }>[]; conflict: boolean }>> {
    if (memberships.length === 0) return Object.freeze({ principal: null, memberships: Object.freeze([]), conflict: false });
    const unique = Object.freeze([...new Set(memberships)].sort());
    const result = await this.repository.directoryMemberships(database, unique);
    const principals = [...new Set(result.map((row) => row.principal))];
    if (principals.length !== 1) return Object.freeze({ principal: null, memberships: Object.freeze([]), conflict: principals.length > 1 });
    return Object.freeze({ principal: principals[0]!, memberships: Object.freeze(result.map((row) => Object.freeze({ id: row.id, target: row.client }))), conflict: false });
  }

  async ensureImported(database: OperationDatabase, input: ImportedMembership): Promise<void> {
    await this.repository.ensureImported(database, {
      membership: input.membership,
      member: input.member,
      principal: input.principal,
      organization: input.organization,
      client: input.client === 'storefront' ? 'storefront' : 'operator',
      employee: input.employee,
    });
  }

  async member(database: OperationDatabase, membership: string): Promise<string> {
    const member = await this.repository.activeMember(database, membership);
    if (member === null) throw new Error('MEMBERSHIP_NOT_FOUND');
    return member;
  }

  activeIn(database: OperationDatabase, member: string, organizations: readonly string[]): Promise<boolean> {
    return this.repository.activeMemberIn(database, member, organizations);
  }

  async members(database: OperationDatabase, organization: string, after: string | null, limit: number): Promise<readonly AccessMember[]> {
    return Object.freeze((await this.repository.memberPage(database, organization, after, limit)).map(mapAccessMember));
  }

  async profile(database: OperationDatabase, membership: string): Promise<AccessMember> {
    const row = await this.repository.memberProfile(database, membership);
    if (!row) throw new DomainError('MEMBERSHIP_SELECTION_REQUIRED');
    return mapAccessMember(row);
  }

  async setEmployeeNumber(database: OperationDatabase, membership: string, employee: string | null): Promise<void> {
    if (!(await this.repository.setEmployeeNumber(database, membership, employee))) throw new Error('MEMBERSHIP_NOT_FOUND');
  }

  async memberForManagement(database: OperationDatabase, membership: string): Promise<Readonly<{ member: string; accessVersion: number }>> {
    const target = await this.repository.managementMember(database, membership);
    if (target === null) throw new Error('MEMBERSHIP_NOT_FOUND');
    return target;
  }

  async changeStatus(database: OperationDatabase, membership: string, status: 'active' | 'suspended' | 'left') {
    if (!(await this.repository.setMembershipStatus(database, membership, status))) throw new Error('MEMBERSHIP_NOT_FOUND');
    const version = await this.versions.bump(database, membership, `membership${status}`, 'access:memberstatus');
    return Object.freeze({ accessVersion: version });
  }

  async replaceDepartment(database: OperationDatabase, input: Readonly<{ membership: string; department: string; path: string; grant: string }>): Promise<void> {
    await this.repository.replaceDepartment(database, input);
    await this.versions.bump(database, input.membership, 'departmentscopechanged', 'access:department');
  }

  async applyDirectoryLifecycle(
    database: OperationDatabase,
    input: Readonly<{ membership: string; status: 'active' | 'suspended' | 'left'; department: string | null; grant: string; scope: string; trace: string; reason: 'directoryfreeze' | 'directoryrestore' | 'directoryupdate' }>
  ): Promise<number> {
    const current = await this.repository.applyDirectoryState(database, { membership: input.membership, status: input.status });
    if (current === null) throw new Error('MEMBERSHIP_NOT_FOUND');
    if (input.department !== null) {
      await this.repository.replaceDirectoryDepartment(database, { membership: input.membership, department: input.department, grant: input.grant, accessVersion: current });
    }
    return this.versions.bump(database, input.membership, input.reason, input.trace);
  }
}

function mapAccessMember(row: Readonly<{ id: string; member: string; organization: string; employee: string | null; status: string; accessVersion: number; joinedAt: Date | null }>): AccessMember {
  return Object.freeze({ id: row.id, member: row.member, organization: row.organization, employee: row.employee, status: row.status, accessversion: row.accessVersion, joinedat: row.joinedAt });
}
