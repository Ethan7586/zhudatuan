import { checkAssurance, checkScope, permissionDefinition, precheck, type MembershipAccess } from '@shop/authz';
import { OperationCatalog, requiresFinancialActionProof, requiresFinancialExpectedVersion } from '@shop/contract';
import type { Clock } from '@shop/kernel';
import { DomainError } from '../domain/DomainError';
import type { AccessContext } from './AccessContext';
import { requireMembershipConsumptionContext, type MembershipConsumptionContext } from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';
import type { SessionResolver } from './SessionResolver';
import { StepupPolicy } from './StepupPolicy';
import type { DecisionSink } from './DecisionSink';
import { assertRiskAllowed, type RiskGate } from './RiskGate';
import type { ActionProofVerifier } from './ActionProof';
import { ResolveMallContext } from '../../modules/mall';
import type { GovernanceResolver } from './GovernanceResolver';
import type { OperationAvailabilityResolver } from './OperationAvailability';

export interface MembershipResolver {
  resolve(actor: string, context?: MembershipConsumptionContext): Promise<MembershipAccess | MembershipSnapshot>;
}

export interface MembershipSnapshot {
  readonly access: MembershipAccess;
  readonly evaluatedAt: Date;
  readonly capabilities?: readonly string[];
}

export interface AccessVersionResolver {
  resolve(membership: string, context?: MembershipConsumptionContext): Promise<number>;
}

export interface CapabilityResolver {
  resolve(membership: string, context?: MembershipConsumptionContext): Promise<readonly string[]>;
}

export class AccessPipeline {
  private readonly mallContexts = new ResolveMallContext();

  constructor(
    private readonly sessions: SessionResolver,
    private readonly memberships: MembershipResolver,
    private readonly versions: AccessVersionResolver,
    private readonly scopes: ScopeResolver,
    private readonly capabilities: CapabilityResolver,
    private readonly availability: OperationAvailabilityResolver,
    private readonly clock: Clock,
    private readonly risk: RiskGate,
    private readonly decisions: DecisionSink,
    private readonly stepup = new StepupPolicy(),
    private readonly actionProof?: ActionProofVerifier,
    private readonly governance?: GovernanceResolver
  ) {}

  async authorize(headers: Readonly<Record<string, string>>, operation: string, permission: string, resource?: string): Promise<AccessContext> {
    const actor = await this.sessions.resolve(headers);
    const trace = headers['x-trace-id'] ?? actor.session;
    let scope: AccessContext['scope'] | undefined;
    try {
      assertAudienceTarget(operation, actor.target);
      const feature = await this.availability.resolveFeature(actor, operation);
      if (!feature.featureDeclared) {
        throw new DomainError('FEATURE_NOT_DECLARED', { requiredFeatures: feature.requiredFeatures });
      }
      const consumptionContext = requireMembershipConsumptionContext(actor);
      const resolvedMembership = await this.memberships.resolve(actor.membership, consumptionContext);
      let snapshot: MembershipSnapshot | undefined;
      let membership: MembershipAccess;
      if (isMembershipSnapshot(resolvedMembership)) {
        snapshot = resolvedMembership;
        membership = resolvedMembership.access;
      } else {
        membership = resolvedMembership;
      }
      if (membership.id !== actor.membership) throw new DomainError('MEMBERSHIP_INACTIVE', { reason: 'MEMBERSHIP_CONTEXT_MISMATCH' });
      const accessVersion = snapshot?.access.accessVersion ?? await this.versions.resolve(membership.id, consumptionContext);
      const now = snapshot?.evaluatedAt ?? this.clock.now();
      if (!Number.isFinite(now.getTime())) throw new DomainError('PERMISSION_DENIED', { reason: 'AUTHORIZATION_TIME_INVALID' });
      const permissionFailure = precheck(membership, permission, { expectedAccessVersion: actor.accessVersion, now });
      if (permissionFailure !== null) throw new DomainError(mapReason(permissionFailure));
      if (accessVersion !== actor.accessVersion) throw new DomainError('MEMBERSHIP_INACTIVE', { reason: 'ACCESS_VERSION_STALE' });
      const scopeHint = headers['x-scope-hint'];
      if (scopeHint !== undefined && (!scopeHint || scopeHint.length > 255)) throw new DomainError('SCOPE_DENIED');
      scope = await this.scopes.resolve(actor, operation, resource, scopeHint);
      const scopeDecision = checkScope(membership, permission, scope, now);
      if ('reason' in scopeDecision) throw new DomainError(mapReason(scopeDecision.reason));
      const governance = await this.governance?.resolve(actor, membership, scope);
      const mallContext = this.mallContexts.resolve(scope, membership, scopeHint);
      const capabilities = snapshot?.capabilities ?? await this.capabilities.resolve(membership.id, consumptionContext);
      if (!capabilities.includes(operation)) {
        throw new DomainError('CAPABILITY_DENIED', { operation });
      }
      if (!await this.availability.resourceReady(actor, operation, resource)) {
        throw new DomainError('RESOURCE_NOT_READY', { operation });
      }
      const assuranceFailure = checkAssurance(permission, { now, ...(actor.assurance.verified === undefined ? {} : { stepupAt: actor.assurance.verified }) });
      if (assuranceFailure !== null || !this.stepup.accepts(permissionDefinition(permission).stepup, actor.assurance, now)) throw new DomainError('STEPUP_REQUIRED');
      const risk = await this.risk.evaluate({ actor, operation, scope, trace, ...(resource === undefined ? {} : { resource }) });
      assertRiskAllowed(risk.outcome);
      if (requiresFinancialActionProof(operation)) {
        const proof = headers['x-action-proof'];
        const idempotency = headers['idempotency-key'];
        const expectedVersion = expectedVersionHeader(headers['if-match']);
        if (!proof || !idempotency || idempotency.length > 255 || (requiresFinancialExpectedVersion(operation) && expectedVersion === null) || !this.actionProof?.validate(proof)) {
          throw new DomainError('ACTION_PROOF_REQUIRED');
        }
      }
      await this.decisions.append({ actor, operation, scope, outcome: 'allow', reason: 'POLICY_ALLOWED', trace, ...(resource === undefined ? {} : { resource }) });
      return {
        actor,
        membership,
        scope,
        ...(governance === undefined ? {} : { governance }),
        ...(mallContext === null ? {} : { mallContext, mall_id: mallContext.mall_id }),
        accessVersion,
        capabilities,
        assurance: actor.assurance,
        trace,
      };
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

function isMembershipSnapshot(value: MembershipAccess | MembershipSnapshot): value is MembershipSnapshot {
  return 'access' in value && 'evaluatedAt' in value;
}

function expectedVersionHeader(header: string | undefined): number | null {
  if (header === undefined) return null;
  const normalized = header.replace(/^W\//, '').replace(/^"|"$/g, '');
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('EXPECTED_VERSION_INVALID');
  return value;
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
