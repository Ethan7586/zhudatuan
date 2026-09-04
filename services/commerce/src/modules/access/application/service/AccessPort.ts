import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { IdentityAccessPort, IdentityMembership } from '../../public/IdentityAccessPort';
import type { ImportedMembership, MemberImportAccessPort } from '../../public/MemberImportAccessPort';
import type { AccessVersionPublisher } from './AccessVersionPublisher';
import type { AccessMember, MemberAccessPort, MemberProfileProjection } from '../../public/MemberAccessPort';
import type { AccessRepository, ActiveMembershipReference } from '../port/AccessRepository';
export class AccessPort implements IdentityAccessPort, MemberAccessPort, MemberImportAccessPort {
  constructor(
    private readonly repository: AccessRepository,
    private readonly versions: AccessVersionPublisher
  ) {}
  async memberships(
    context: ReadTransactionContext,
    member: string,
    target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'
  ): Promise<readonly IdentityMembership[]> {
    const result = await this.repository.activeMemberships(context, member, target);
    return Object.freeze(result.map(toIdentityMembership));
  }
  async session(
    context: WriteTransactionContext,
    membership: string,
    target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'
  ): Promise<
    Readonly<{
      accessVersion: number;
      client: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
    }>
  > {
    const accessVersion = await this.repository.lockSession(context, membership, target);
    if (accessVersion === null) throw new DomainError('MEMBERSHIP_SELECTION_REQUIRED');
    return Object.freeze({ accessVersion, client: target });
  }
  async directoryMemberships(
    context: ReadTransactionContext,
    memberships: readonly string[]
  ): Promise<
    Readonly<{
      principal: string | null;
      memberships: readonly IdentityMembership[];
      conflict: boolean;
    }>
  > {
    if (memberships.length === 0) return Object.freeze({ principal: null, memberships: Object.freeze([]), conflict: false });
    const unique = Object.freeze([...new Set(memberships)].sort());
    const result = await this.repository.directoryMemberships(context, unique);
    const principals = [...new Set(result.map((row) => row.principal))];
    if (principals.length !== 1) return Object.freeze({ principal: null, memberships: Object.freeze([]), conflict: principals.length > 1 });
    return Object.freeze({ principal: principals[0]!, memberships: Object.freeze(result.map(toIdentityMembership)), conflict: false });
  }
  async ensureImported(context: WriteTransactionContext, input: ImportedMembership): Promise<void> {
    await this.repository.ensureImported(context, {
      membership: input.membership,
      member: input.member,
      principal: input.principal,
      organization: input.organization,
      client: input.client === 'storefront' ? 'storefront' : 'operator',
      employee: input.employee,
    });
  }
  async member(context: ReadTransactionContext, membership: string): Promise<string> {
    const member = await this.repository.activeMember(context, membership);
    if (member === null) throw new Error('MEMBERSHIP_NOT_FOUND');
    return member;
  }
  activeIn(context: ReadTransactionContext, member: string, organizations: readonly string[]): Promise<boolean> {
    return this.repository.activeMemberIn(context, member, organizations);
  }
  async members(context: ReadTransactionContext, organization: string, actorMembership: string, after: string | null, limit: number): Promise<readonly AccessMember[]> {
    return Object.freeze((await this.repository.memberPage(context, organization, actorMembership, after, limit)).map(mapAccessMember));
  }
  async profile(context: ReadTransactionContext, membership: string): Promise<AccessMember> {
    const row = await this.repository.memberProfile(context, membership);
    if (!row) throw new DomainError('MEMBERSHIP_SELECTION_REQUIRED');
    return mapAccessMember(row);
  }
  syncProfile(context: WriteTransactionContext, profile: MemberProfileProjection): Promise<void> {
    return this.repository.upsertMemberProfile(context, profile);
  }
  async setEmployeeNumber(context: WriteTransactionContext, membership: string, employee: string | null): Promise<void> {
    if (!(await this.repository.setEmployeeNumber(context, membership, employee))) throw new Error('MEMBERSHIP_NOT_FOUND');
  }
  async memberForManagement(
    context: WriteTransactionContext,
    membership: string
  ): Promise<
    Readonly<{
      member: string;
      accessVersion: number;
    }>
  > {
    const target = await this.repository.managementMember(context, membership);
    if (target === null) throw new Error('MEMBERSHIP_NOT_FOUND');
    return target;
  }
  async resetRegistrations(context: WriteTransactionContext, input: Readonly<{ member: string; actorMembership: string; trace: string }>) {
    const changes = await this.repository.resetMemberRegistrations(context, input.member, input.actorMembership);
    if (changes === null) throw new DomainError('AUTHORIZATION_DENIED');
    if (changes.length === 0) throw new DomainError('MEMBERSHIP_INACTIVE');
    await this.repository.versionChanged(context, changes, 'registrationreset', input.trace);
    return Object.freeze({ memberships: Object.freeze(changes.map(({ membership }) => membership)), accessVersion: Math.max(...changes.map(({ version }) => version)) });
  }
  async changeStatus(context: WriteTransactionContext, membership: string, status: 'active' | 'suspended' | 'left') {
    if (!(await this.repository.setMembershipStatus(context, membership, status))) throw new Error('MEMBERSHIP_NOT_FOUND');
    const version = await this.versions.bump(context, membership, `membership${status}`, 'access:memberstatus');
    return Object.freeze({ accessVersion: version });
  }
  async replaceDepartment(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      department: string;
      path: string;
      grant: string;
    }>
  ): Promise<void> {
    await this.repository.replaceDepartment(context, input);
    await this.versions.bump(context, input.membership, 'departmentscopechanged', 'access:department');
  }
  async applyDirectoryLifecycle(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      status: 'active' | 'suspended' | 'left';
      department: string | null;
      grant: string;
      scope: string;
      trace: string;
      reason: 'directoryfreeze' | 'directoryrestore' | 'directoryupdate';
    }>
  ): Promise<number> {
    const current = await this.repository.applyDirectoryState(context, { membership: input.membership, status: input.status });
    if (current === null) throw new Error('MEMBERSHIP_NOT_FOUND');
    if (input.department !== null) {
      await this.repository.replaceDirectoryDepartment(context, { membership: input.membership, department: input.department, grant: input.grant, accessVersion: current });
    }
    return this.versions.bump(context, input.membership, input.reason, input.trace);
  }
}

function toIdentityMembership(row: ActiveMembershipReference): IdentityMembership {
  return Object.freeze({
    id: row.id,
    target: row.client,
    organization: row.organization,
    accessVersion: row.accessVersion,
    displayName: row.displayName,
    organizationName: row.organizationName,
    scopeKind: row.scopeKind,
    scopeId: row.scopeId,
    roleLabel: row.roleLabel,
    logoUrl: row.logoUrl,
  });
}
function mapAccessMember(
  row: Readonly<{
    id: string;
    member: string;
    organization: string;
    employee: string | null;
    status: string;
    accessVersion: number;
    joinedAt: Date | null;
    registrationResetAllowed: boolean;
    registrationResetBlockReason: 'self' | 'protected' | 'inactive' | null;
  }>
): AccessMember {
  return Object.freeze({
    id: row.id,
    member: row.member,
    organization: row.organization,
    employee: row.employee,
    status: row.status,
    accessversion: row.accessVersion,
    joinedat: row.joinedAt,
    registrationresetallowed: row.registrationResetAllowed,
    registrationresetblockreason: row.registrationResetBlockReason,
  });
}
