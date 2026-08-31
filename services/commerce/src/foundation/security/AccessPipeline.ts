import { checkAssurance, checkScope, permissionDefinition, precheck, type MembershipAccess } from '@shop/authz';
<<<<<<< HEAD
<<<<<<< HEAD
import { OperationCatalog, requiresFinancialActionProof, requiresFinancialExpectedVersion } from '@shop/contract';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { OperationCatalog, requiresFinancialActionProof, requiresFinancialExpectedVersion } from '@shop/contract';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import type { Clock } from '@shop/kernel';
import { DomainError } from '../domain/DomainError';
import type { AccessContext } from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';
import type { SessionResolver } from './SessionResolver';
import { StepupPolicy } from './StepupPolicy';
import type { DecisionSink } from './DecisionSink';
import { assertRiskAllowed, type RiskGate } from './RiskGate';
<<<<<<< HEAD
<<<<<<< HEAD
import type { ActionProofVerifier } from './ActionProof';

export interface MembershipResolver {
  resolve(actor: string): Promise<MembershipAccess | MembershipSnapshot>;
}

export interface MembershipSnapshot {
  readonly access: MembershipAccess;
  readonly evaluatedAt: Date;
=======

export interface MembershipResolver {
  resolve(actor: string): Promise<MembershipAccess>;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import type { ActionProofVerifier } from './ActionProof';

export interface MembershipResolver {
  resolve(actor: string): Promise<MembershipAccess | MembershipSnapshot>;
}

export interface MembershipSnapshot {
  readonly access: MembershipAccess;
  readonly evaluatedAt: Date;
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
    private readonly stepup = new StepupPolicy(),
<<<<<<< HEAD
<<<<<<< HEAD
    private readonly actionProof?: ActionProofVerifier
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    private readonly actionProof?: ActionProofVerifier
>>>>>>> 018b2a71 (chore(release): capture current production source)
  ) {}

  async authorize(headers: Readonly<Record<string, string>>, operation: string, permission: string, resource?: string): Promise<AccessContext> {
    const actor = await this.sessions.resolve(headers);
    const trace = headers['x-trace-id'] ?? actor.session;
    let scope: AccessContext['scope'] | undefined;
    try {
<<<<<<< HEAD
      assertAudienceTarget(operation, actor.target);
      const resolvedMembership = await this.memberships.resolve(actor.membership);
      const membership = isMembershipSnapshot(resolvedMembership) ? resolvedMembership.access : resolvedMembership;
<<<<<<< HEAD
      const accessVersion = await this.versions.resolve(membership.id);
      const now = isMembershipSnapshot(resolvedMembership) ? resolvedMembership.evaluatedAt : this.clock.now();
      if (!Number.isFinite(now.getTime())) throw new DomainError('PERMISSION_DENIED', { reason: 'AUTHORIZATION_TIME_INVALID' });
=======
      const membership = await this.memberships.resolve(actor.membership);
      const accessVersion = await this.versions.resolve(membership.id);
      const now = this.clock.now();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      const accessVersion = await this.versions.resolve(membership.id);
      const now = isMembershipSnapshot(resolvedMembership) ? resolvedMembership.evaluatedAt : this.clock.now();
      if (!Number.isFinite(now.getTime())) throw new DomainError('PERMISSION_DENIED', { reason: 'AUTHORIZATION_TIME_INVALID' });
>>>>>>> 018b2a71 (chore(release): capture current production source)
      const permissionFailure = precheck(membership, permission, { expectedAccessVersion: actor.accessVersion, now });
      if (permissionFailure !== null) throw new DomainError(mapReason(permissionFailure));
      if (accessVersion !== actor.accessVersion) throw new DomainError('MEMBERSHIP_INACTIVE', { reason: 'ACCESS_VERSION_STALE' });
      const scopeHint = headers['x-scope-hint'];
      if (scopeHint !== undefined && (!scopeHint || scopeHint.length > 255)) throw new DomainError('SCOPE_DENIED');
<<<<<<< HEAD
<<<<<<< HEAD
      scope = await this.scopes.resolve(actor, operation, resource, scopeHint);
=======
      scope = await this.scopes.resolve(actor, operation, resource ?? scopeHint);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      scope = await this.scopes.resolve(actor, operation, resource, scopeHint);
>>>>>>> 018b2a71 (chore(release): capture current production source)
      const scopeDecision = checkScope(membership, permission, scope, now);
      if ('reason' in scopeDecision) throw new DomainError(mapReason(scopeDecision.reason));
      const capabilities = await this.capabilities.resolve(membership.id);
      if (!capabilities.includes(operation)) throw new DomainError('PERMISSION_DENIED', { operation });
      const assuranceFailure = checkAssurance(permission, { now, ...(actor.assurance.verified === undefined ? {} : { stepupAt: actor.assurance.verified }) });
      if (assuranceFailure !== null || !this.stepup.accepts(permissionDefinition(permission).stepup, actor.assurance, now)) throw new DomainError('STEPUP_REQUIRED');
      const risk = await this.risk.evaluate({ actor, operation, scope, trace, ...(resource === undefined ? {} : { resource }) });
      assertRiskAllowed(risk.outcome);
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      if (requiresFinancialActionProof(operation)) {
        const proof = headers['x-action-proof'];
        const idempotency = headers['idempotency-key'];
        const expectedVersion = expectedVersionHeader(headers['if-match']);
        if (!proof || !idempotency || idempotency.length > 255 || (requiresFinancialExpectedVersion(operation) && expectedVersion === null) || !this.actionProof?.validate(proof)) {
          throw new DomainError('ACTION_PROOF_REQUIRED');
        }
      }
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      await this.decisions.append({ actor, operation, scope, outcome: 'allow', reason: 'POLICY_ALLOWED', trace, ...(resource === undefined ? {} : { resource }) });
      return { actor, membership, scope, accessVersion, capabilities, assurance: actor.assurance, trace };
    } catch (cause) {
      const reason = cause instanceof DomainError ? cause.code : cause instanceof Error ? cause.message : 'AUTHORIZATION_FAILED';
      await this.decisions.append({ actor, operation, outcome: reason === 'STEPUP_REQUIRED' ? 'challenge' : reason === 'RISK_REVIEW_REQUIRED' ? 'review' : 'deny', reason, trace,
        ...(scope === undefined ? {} : { scope }), ...(resource === undefined ? {} : { resource }) });
      throw cause;
    }
  }
}

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
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

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
function mapReason(reason: string): string {
  if (reason === 'STEPUP_REQUIRED') return 'STEPUP_REQUIRED';
  if (reason === 'MEMBERSHIP_INACTIVE' || reason === 'ACCESS_VERSION_STALE') return 'MEMBERSHIP_INACTIVE';
  if (reason === 'SCOPE_DENIED' || reason === 'SCOPE_KIND_DENIED') return 'SCOPE_DENIED';
  return 'PERMISSION_DENIED';
}
