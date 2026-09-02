import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { EmployeeInvitationPreparation, InvitationAccessPort, InvitationCampaignActivation, InvitationCampaignValidation, InvitationGrantPlan, PendingEmployeeAccess } from '../../public/InvitationAccessPort';
import type { GrantPlan } from '../../domain/model/GrantPlan';
import type { DelegationPolicy } from '../../domain/policy/DelegationPolicy';
import type { ActivateMembership } from './ActivateMembership';
import type { AccessRepository } from '../port/AccessRepository';
import type { CreateInvitationGrant, BuiltGrant, InvitationPlanInput } from './CreateInvitationGrant';
import type { AccessOrganizationPort } from '../../../organization/public';
export class DelegationService implements InvitationAccessPort {
  constructor(
    private readonly repository: AccessRepository,
    private readonly policy: DelegationPolicy,
    private readonly activation: ActivateMembership,
    private readonly grants: CreateInvitationGrant,
    private readonly organizations: AccessOrganizationPort
  ) {}
  async plan(context: ReadTransactionContext, input: InvitationPlanInput): Promise<InvitationGrantPlan> {
    const built = await this.grants.execute(context, input);
    if (input.expectedVersion !== undefined && built.issuerVersion !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    this.assertDelegation(built);
    return publicPlan(built);
  }
  async validate(
    context: ReadTransactionContext,
    invitation: Readonly<{
      issuer: string;
      issuerAccessVersion: number;
      membership: string;
      grantDigest: string;
      organization: string;
      target: 'console' | 'storefront';
    }>
  ): Promise<void> {
    const built = await this.grants.execute(context, { issuer: invitation.issuer, membership: invitation.membership, organization: invitation.organization, target: invitation.target, kind: 'signin', policy: null, termsHash: null });
    this.assertDelegation(built);
    if (built.issuerVersion !== invitation.issuerAccessVersion || built.plan.digest() !== invitation.grantDigest) {
      throw new DomainError('INVITATION_STALE');
    }
  }
  async validateCampaign(context: ReadTransactionContext, input: InvitationCampaignValidation): Promise<void> {
    await this.campaignTemplate(context, input);
  }
  async createCampaign(
    context: WriteTransactionContext,
    input: InvitationCampaignActivation
  ): Promise<
    Readonly<{
      activationDigest: string;
    }>
  > {
    await this.campaignTemplate(context, input);
    await this.repository.createStorefrontMembership(context, {
      membership: input.membership,
      member: input.member,
      principal: input.principal,
      organization: input.organization,
      issuer: input.issuer,
      issuerAccessVersion: input.issuerAccessVersion,
      employeeNo: null,
      department: null,
    });
    const actual = await this.grants.execute(context, {
      issuer: input.issuer,
      membership: input.membership,
      organization: input.organization,
      target: 'storefront',
      kind: 'enrollment',
      policy: input.policy,
      termsHash: input.termsHash,
      expiresAt: input.expiresAt,
    });
    this.assertDelegation(actual);
    return Object.freeze({ activationDigest: actual.plan.digest() });
  }
  async prepareEmployee(context: WriteTransactionContext, input: EmployeeInvitationPreparation): Promise<Readonly<{ grantDigest: string }>> {
    const template = await this.grants.execute(context, {
      issuer: input.issuer,
      membership: null,
      organization: input.organization,
      target: 'storefront',
      kind: 'campaign',
      policy: input.policy,
      termsHash: input.termsHash,
      expiresAt: input.expiresAt,
    });
    this.assertDelegation(template);
    if (template.issuerVersion !== input.issuerAccessVersion) throw new DomainError('VERSION_CONFLICT');
    if (input.department !== null && !(await this.organizations.employeeDepartment(context, input.department, input.organization))) {
      throw new DomainError('DELEGATION_DENIED');
    }
    await this.repository.createStorefrontMembership(context, {
      membership: input.membership,
      member: input.member,
      principal: input.principal,
      organization: input.organization,
      issuer: input.issuer,
      issuerAccessVersion: input.issuerAccessVersion,
      employeeNo: input.employeeNo,
      department: input.department,
    });
    const actual = await this.grants.execute(context, {
      issuer: input.issuer,
      membership: input.membership,
      organization: input.organization,
      target: 'storefront',
      kind: 'enrollment',
      policy: input.policy,
      termsHash: input.termsHash,
      expiresAt: input.expiresAt,
    });
    this.assertDelegation(actual);
    if (actual.issuerVersion !== input.issuerAccessVersion || actual.plan.principal !== input.principal) throw new DomainError('INVITATION_STALE');
    return Object.freeze({ grantDigest: actual.plan.digest() });
  }
  private async campaignTemplate(context: ReadTransactionContext, input: InvitationCampaignValidation): Promise<BuiltGrant> {
    const template = await this.grants.execute(context, {
      issuer: input.issuer,
      membership: null,
      organization: input.organization,
      target: 'storefront',
      kind: 'campaign',
      policy: input.policy,
      termsHash: input.termsHash,
      expiresAt: input.expiresAt,
    });
    this.assertDelegation(template);
    if (template.issuerVersion !== input.issuerAccessVersion || template.plan.digest() !== input.grantDigest) {
      throw new DomainError('INVITATION_STALE');
    }
    return template;
  }
  async activate(
    context: WriteTransactionContext,
    input: Readonly<{
      issuer: string;
      issuerAccessVersion: number;
      membership: string;
      principal: string;
      grantDigest: string;
      organization: string;
      target: 'storefront';
      invitation: string;
      policy: string | null;
      termsHash: string | null;
      trace: string;
    }>
  ): Promise<number> {
    const built = await this.grants.execute(context, { issuer: input.issuer, membership: input.membership, organization: input.organization, target: input.target, kind: 'enrollment', policy: input.policy, termsHash: input.termsHash });
    this.assertDelegation(built);
    return this.activation.execute(
      context,
      {
        issuerVersion: input.issuerAccessVersion,
        membership: input.membership,
        principal: input.principal,
        organization: input.organization,
        target: input.target,
        digest: input.grantDigest,
        invitation: input.invitation,
        trace: input.trace,
      },
      { membership: built.plan.membership, principal: built.plan.principal, organization: built.plan.organization, target: built.plan.target, issuerVersion: built.issuerVersion, digest: built.plan.digest() }
    );
  }
  async pending(context: ReadTransactionContext, membership: string): Promise<string> {
    const member = await this.repository.pendingMember(context, membership);
    if (member === null) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    return member;
  }
  async pendingEmployee(context: ReadTransactionContext, membership: string): Promise<PendingEmployeeAccess> {
    const employee = await this.repository.pendingEmployee(context, membership);
    if (employee === null) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    const department = employee.department === null ? null : await this.organizations.employeeDepartment(context, employee.department, employee.organization);
    return Object.freeze({ member: employee.member, employeeNo: employee.employeeNo, departmentName: department?.name ?? null });
  }
  private assertDelegation(built: BuiltGrant): void {
    const delegation = {
      roleKinds: built.plan.roles.map(({ kind }) => kind),
      issuerPermissions: new Set(built.issuerAllows),
      issuerDenies: new Set(built.issuerDenies),
      targetPermissions: delegatedPermissions(built.plan),
      scopeAllowed: built.scopeAllowed,
    };
    if (built.plan.membership === null) this.policy.assertCampaign(delegation);
    else this.policy.assert(delegation);
  }
}
export function delegatedPermissions(plan: GrantPlan): readonly string[] {
  const customRoles = new Set(plan.roles.filter(({ kind }) => kind === 'custom').map(({ id }) => id));
  const effects = new Map<string, 'allow' | 'deny'>();
  for (const permission of plan.permissions) {
    if (!customRoles.has(permission.role)) continue;
    if (permission.effect === 'deny' || !effects.has(permission.code)) effects.set(permission.code, permission.effect);
  }
  return Object.freeze([...effects].filter(([, effect]) => effect === 'allow').map(([code]) => code));
}
function publicPlan(
  value: Readonly<{
    plan: GrantPlan;
    issuerVersion: number;
  }>
): InvitationGrantPlan {
  return Object.freeze({
    organization: value.plan.organization,
    membership: value.plan.membership,
    principal: value.plan.principal,
    issuerAccessVersion: value.issuerVersion,
    grantDigest: value.plan.digest(),
    minimumAssurance: value.plan.minimumAssurance,
  });
}
