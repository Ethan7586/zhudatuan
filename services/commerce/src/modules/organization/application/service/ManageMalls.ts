import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { Mall, type MallPatch } from '../../domain/model/Mall';
import { Membership } from '../../domain/model/Membership';
import { HierarchyPolicy } from '../../domain/policy/HierarchyPolicy';
import { MallPolicy } from '../../domain/policy/MallPolicy';
import type { CreateMallCommand } from '../model/MallCommand';
import type { OrganizationRepository } from '../port/OrganizationRepository';

export class ManageMalls {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly hierarchy: HierarchyPolicy = new HierarchyPolicy(),
    private readonly policy: MallPolicy = new MallPolicy()
  ) {}

  async create(context: WriteTransactionContext, input: Readonly<{ command: CreateMallCommand; accessScope: string; actorMembership: string; expectedParentVersion: number; now: string }>): Promise<Mall> {
    const parent = await this.organizations.lockMallParent(context, input.command.parentId, input.accessScope);
    this.hierarchy.assertMallParent({ parent: parent.organization, visible: parent.visible, activeMalls: parent.activeMalls, accessScope: input.accessScope, expectedVersion: input.expectedParentVersion });
    const ownerAllowed = await this.organizations.membershipWithin(context, input.command.ownerMembershipId, parent.organization.id);
    this.hierarchy.assertOwner(input.command.ownerMembershipId, input.actorMembership, ownerAllowed);
    const profile = this.policy.profile(input.command);
    const id = `mall:${randomUUID()}`;
    const organization = parent.organization.allocateMall({ id, name: input.command.name, timezone: input.command.timezone, now: input.now });
    const mall = new Mall({ organization, ...profile, version: 1, createdat: input.now, updatedat: input.now });
    const owner = Membership.owner(`organizationmembership:${randomUUID()}`, id, profile.ownerMembershipId, input.now);
    return this.organizations.createMall(context, { parent: parent.organization, mall, owner, expectedParentVersion: input.expectedParentVersion });
  }

  read(context: ReadTransactionContext, mall: string, accessScope: string): Promise<Mall> {
    return this.organizations.mall(context, mall, accessScope);
  }

  async update(context: WriteTransactionContext, input: Readonly<{ mall: string; patch: MallPatch; accessScope: string; actorMembership: string; expectedVersion: number; now: string }>): Promise<Mall> {
    const current = await this.organizations.lockMall(context, input.mall, input.accessScope);
    if (current.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const profile = this.policy.profile({
      code: current.code,
      publicSlug: current.publicSlug,
      brandName: input.patch.brandName ?? current.brandName,
      domain: input.patch.domain ?? current.domain,
      ownerMembershipId: input.patch.ownerMembershipId ?? current.ownerMembershipId,
      currency: input.patch.currency ?? current.currency,
      theme: input.patch.theme ?? current.theme,
      opening: input.patch.opening ?? current.opening,
    });
    const ownerChanged = profile.ownerMembershipId !== current.ownerMembershipId;
    if (ownerChanged) {
      const ownerAllowed = await this.organizations.membershipWithin(context, profile.ownerMembershipId, current.organization.parentid!);
      this.hierarchy.assertOwner(profile.ownerMembershipId, input.actorMembership, ownerAllowed);
    }
    const organization = current.organization.revised({
      name: input.patch.name ?? current.organization.name,
      timezone: input.patch.timezone ?? current.organization.timezone,
      status: input.patch.status ?? current.organization.status,
      now: input.now,
    });
    const mall = current.revise({ ...input.patch, ...profile }, organization, input.now);
    const owner = ownerChanged ? Membership.owner(`organizationmembership:${randomUUID()}`, current.organization.id, profile.ownerMembershipId, input.now) : null;
    return this.organizations.updateMall(context, { current, mall, owner, expectedVersion: input.expectedVersion });
  }
}
