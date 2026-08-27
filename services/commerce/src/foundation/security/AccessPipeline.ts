import { checkAssurance, checkScope, permissionDefinition, precheck, type MembershipAccess } from '@shop/authz';
import { OperationCatalog } from '@shop/contract';
import type { Clock } from '@shop/kernel';
import { DomainError } from '../domain/DomainError';
import type { AccessContext } from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';
import type { SessionResolver } from './SessionResolver';
import { StepupPolicy } from './StepupPolicy';
import type { DecisionSink } from './DecisionSink';
import { assertRiskAllowed, type RiskGate } from './RiskGate';

export interface MembershipResolver {
  resolve(actor: string): Promise<MembershipAccess>;
}

export interface AccessVersionResolver {
  resolve(membership: string): Promise<number>;
}

export interface CapabilityResolver {
  resolve(membership: string): Promise<readonly string[]>;
}

export class AccessPipeline {
  constructor(
    private readonly sessions: SessionResolver,
    private readonly memberships: MembershipResolver,
    private readonly versions: AccessVersionResolver,
    private readonly scopes: ScopeResolver,
    private readonly capabilities: CapabilityResolver,
    private readonly clock: Clock,
    private readonly risk: RiskGate,
    private readonly decisions: DecisionSink,
    private readonly stepup = new StepupPolicy()
  ) {}

  async authorize(headers: Readonly<Record<string, string>>, operation: string, permission: string, resource?: string): Promise<AccessContext> {
    const actor = await this.sessions.resolve(headers);
    const trace = headers['x-trace-id'] ?? actor.session;
    let scope: AccessContext['scope'] | undefined;
    try {
      assertAudienceTarget(operation, actor.target);
      const membership = await this.memberships.resolve(actor.membership);
      const accessVersion = await this.versions.resolve(membership.id);
      const now = this.clock.now();
      const permissionFailure = precheck(membership, permission, { expectedAccessVersion: actor.accessVersion, now });
      if (permissionFailure !== null) throw new DomainError(mapReason(permissionFailure));
      if (accessVersion !== actor.accessVersion) throw new DomainError('MEMBERSHIP_INACTIVE', { reason: 'ACCESS_VERSION_STALE' });
      const scopeHint = headers['x-scope-hint'];
      if (scopeHint !== undefined && (!scopeHint || scopeHint.length > 255)) throw new DomainError('SCOPE_DENIED');
      scope = await this.scopes.resolve(actor, operation, resource ?? scopeHint);
      const scopeDecision = checkScope(membership, permission, scope, now);
      if ('reason' in scopeDecision) throw new DomainError(mapReason(scopeDecision.reason));
      const capabilities = await this.capabilities.resolve(membership.id);
      if (!capabilities.includes(operation)) throw new DomainError('PERMISSION_DENIED', { operation });
      const assuranceFailure = checkAssurance(permission, { now, ...(actor.assurance.verified === undefined ? {} : { stepupAt: actor.assurance.verified }) });
      if (assuranceFailure !== null || !this.stepup.accepts(permissionDefinition(permission).stepup, actor.assurance, now)) throw new DomainError('STEPUP_REQUIRED');
      const risk = await this.risk.evaluate({ actor, operation, scope, trace, ...(resource === undefined ? {} : { resource }) });
      assertRiskAllowed(risk.outcome);
      await this.decisions.append({ actor, operation, scope, outcome: 'allow', reason: 'POLICY_ALLOWED', trace, ...(resource === undefined ? {} : { resource }) });
      return { actor, membership, scope, accessVersion, capabilities, assurance: actor.assurance, trace };
    } catch (cause) {
      const reason = cause instanceof DomainError ? cause.code : cause instanceof Error ? cause.message : 'AUTHORIZATION_FAILED';
      await this.decisions.append({
        actor,
        operation,
        outcome: reason === 'STEPUP_REQUIRED' ? 'challenge' : reason === 'RISK_REVIEW_REQUIRED' ? 'review' : 'deny',
        reason,
        trace,
        ...(scope === undefined ? {} : { scope }),
        ...(resource === undefined ? {} : { resource }),
      });
      throw cause;
    }
  }
}

function assertAudienceTarget(operation: string, target: AccessContext['actor']['target']): void {
  const audience = OperationCatalog.get(operation).audience;
  if (audience === 'operator' && target !== 'console') {
    throw new DomainError('PERMISSION_DENIED', { reason: 'AUDIENCE_TARGET_MISMATCH', audience, target });
  }
}

function mapReason(reason: string): string {
  if (reason === 'STEPUP_REQUIRED') return 'STEPUP_REQUIRED';
  if (reason === 'MEMBERSHIP_INACTIVE' || reason === 'ACCESS_VERSION_STALE') return 'MEMBERSHIP_INACTIVE';
  if (reason === 'SCOPE_DENIED' || reason === 'SCOPE_KIND_DENIED') return 'SCOPE_DENIED';
  return 'PERMISSION_DENIED';
}
