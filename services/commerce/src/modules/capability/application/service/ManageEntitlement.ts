import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrganizationReadPort } from '../../../organization/public';
import { CapabilitySet } from '../../domain/model/CapabilitySet';
import { CapabilityPolicy } from '../../domain/policy/CapabilityPolicy';
import type { Assignment, AssignmentRepository } from '../port/AssignmentRepository';

export interface ManageEntitlementInput {
  readonly id: string;
  readonly scope: string;
  readonly capability: string;
  readonly state: 'enabled' | 'disabled';
  readonly quota: number | null;
  readonly expiresAt: Date | null;
  readonly expectedVersion: number;
  readonly actor: string;
  readonly reason: string;
  readonly trace: string;
  readonly now: Date;
}

export class ManageEntitlement {
  constructor(
    private readonly organizations: OrganizationReadPort,
    private readonly assignments: AssignmentRepository,
    private readonly policy = new CapabilityPolicy()
  ) {}

  async execute(context: WriteTransactionContext, input: ManageEntitlementInput): Promise<Assignment> {
    const scope = await this.organizations.scope(context, input.scope, true);
    const parent = scope.ancestors[0] ?? null;
    const plan = await this.assignments.prepare(context, { id: input.id, scope: input.scope, parent, capability: input.capability });
    if (plan === null) throw new DomainError('RESOURCE_NOT_FOUND');
    if ((plan.current?.version ?? 0) !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    this.policy.assertChange(
      { state: input.state, quota: input.quota, expiresAt: input.expiresAt },
      { parent: plan.parent, dependencies: plan.dependencies.map(({ capabilityId, healthy }) => ({ capability: capabilityId, healthy })) },
      input.now
    );
    const set = new CapabilitySet(input.scope, plan.setVersion, parent, scope.descendants.length);
    const change = set.change(
      plan.current,
      { id: input.id, capability: input.capability, state: input.state, quota: input.quota, expiresAt: input.expiresAt },
      input.now,
      { operations: plan.operations, dependentCapabilities: plan.dependentCapabilities }
    );
    const assignment = change.changed
      ? await this.assignments.save(context, change, { expectedSetVersion: plan.setVersion, actor: input.actor, reason: input.reason, trace: input.trace, descendants: scope.descendants.length })
      : await this.assignments.project(context, { scope: input.scope, capability: input.capability, descendants: scope.descendants.length });
    if (assignment === null) throw new DomainError('VERSION_CONFLICT');
    return assignment;
  }
}
