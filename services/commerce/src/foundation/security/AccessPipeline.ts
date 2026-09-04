import { checkAssurance, checkScope, permissionDefinition, precheck } from '@shop/authz';
import { OperationCatalog } from '@shop/contract';
import type { Clock } from '@shop/kernel';
import { DomainError } from '../domain/DomainError';
import type { AccessContext } from './AccessContext';
import type { AuthorizationSnapshotResolver } from './AuthorizationSnapshot';
import type { SessionResolver } from './SessionResolver';
import { StepupPolicy } from './StepupPolicy';
import type { DecisionSink } from './DecisionSink';
import { assertRiskAllowed, type RiskGate } from './RiskGate';

export class AccessPipeline {
  constructor(
    private readonly sessions: SessionResolver,
    private readonly snapshots: AuthorizationSnapshotResolver,
    private readonly clock: Clock,
    private readonly risk: RiskGate,
    private readonly decisions: DecisionSink,
    private readonly stepup = new StepupPolicy()
  ) {}

  async authorize(headers: Readonly<Record<string, string>>, operation: string, permission: string | null, deadline: number, signal: AbortSignal, resource?: string): Promise<AccessContext> {
    const actor = await this.sessions.resolve(headers, operation);
    const trace = headers['x-trace-id'] ?? actor.session;
    let scope: AccessContext['scope'] | undefined;
    try {
      assertAudienceTarget(operation, actor.target);
      const now = this.clock.now();
      const snapshot = await this.snapshots.resolve(actor, operation, resource ?? headers['x-scope-hint']);
      const membership = snapshot.membership;
      if (!membership.active) throw new DomainError('MEMBERSHIP_INACTIVE');
      if (snapshot.credentialVersion !== actor.credentialVersion)
        throw new DomainError('AUTHENTICATION_REQUIRED', {
          reason: 'CREDENTIAL_VERSION_STALE',
        });
      if (snapshot.target !== actor.target) throw new DomainError('PERMISSION_DENIED', { reason: 'AUDIENCE_TARGET_MISMATCH' });
      if (membership.accessVersion !== actor.accessVersion) throw new DomainError('MEMBERSHIP_INACTIVE', { reason: 'ACCESS_VERSION_STALE' });
      assertOperationAssurance(operation, actor.assurance, now, this.stepup);
      const scopeHint = headers['x-scope-hint'];
      if (scopeHint !== undefined && (!scopeHint || scopeHint.length > 255)) throw new DomainError('SCOPE_DENIED');
      scope = snapshot.scope;
      const capabilities = snapshot.capabilities;
      if (permission !== null) {
        const permissionFailure = precheck(membership, permission, { expectedAccessVersion: actor.accessVersion, now });
        if (permissionFailure !== null) throw new DomainError(mapReason(permissionFailure));
        const scopeDecision = checkScope(membership, permission, scope, now);
        if ('reason' in scopeDecision) throw new DomainError(mapReason(scopeDecision.reason));
        if (!capabilities.has(operation)) throw new DomainError('PERMISSION_DENIED', { operation });
        const assuranceFailure = checkAssurance(permission, { now, ...(actor.assurance.verified === undefined ? {} : { stepupAt: actor.assurance.verified }) });
        if (assuranceFailure !== null || !this.stepup.accepts(permissionDefinition(permission).minimumAssurance === 3, actor.assurance, now)) throw new DomainError('STEPUP_REQUIRED');
      }
      const risk = await this.risk.evaluate({ actor, operation, scope, trace, deadline, signal, ...(resource === undefined ? {} : { resource }) });
      assertRiskAllowed(risk.outcome);
      await this.decisions.append({ actor, operation, scope, outcome: 'allow', reason: 'POLICY_ALLOWED', trace, deadline, signal, ...(resource === undefined ? {} : { resource }) });
      return {
        actor,
        membership,
        roles: snapshot.roles,
        organization: snapshot.organization,
        scope,
        accessVersion: membership.accessVersion,
        capabilities,
        capabilityVersion: snapshot.capabilityVersion,
        assurance: actor.assurance,
        trace,
      };
    } catch (cause) {
      const reason = failureReason(cause);
      await this.decisions.append({
        actor,
        operation,
        outcome: reason === 'STEPUP_REQUIRED' ? 'challenge' : reason === 'RISK_REVIEW_REQUIRED' ? 'review' : 'deny',
        reason,
        trace,
        deadline,
        signal,
        ...(scope === undefined ? {} : { scope }),
        ...(resource === undefined ? {} : { resource }),
      });
      throw cause;
    }
  }
}

function failureReason(cause: unknown): string {
  if (cause instanceof DomainError) {
    const detail = cause.details.reason;
    return detail === 'RISK_DENIED' || detail === 'RISK_REVIEW_REQUIRED' ? detail : cause.code;
  }
  return 'AUTHORIZATION_FAILED';
}

function assertAudienceTarget(operation: string, target: AccessContext['actor']['target']): void {
  const definition = OperationCatalog.get(operation);
  if (!(definition.targets as readonly string[]).includes(target))
    throw new DomainError('PERMISSION_DENIED', {
      reason: definition.targets.length === 0 ? 'AUDIENCE_BROWSER_FORBIDDEN' : 'AUDIENCE_TARGET_MISMATCH',
      audience: definition.audience,
      target,
    });
}

function assertOperationAssurance(operation: string, assurance: Readonly<{ level: number; verified?: Date }>, now: Date, stepup: StepupPolicy): void {
  const required = OperationCatalog.get(operation).assuranceLevel;
  const minimum = required === 'stepup' ? 3 : required === 'mfa' ? 2 : 1;
  if (assurance.level < minimum || (required === 'stepup' && !stepup.accepts(true, assurance, now))) throw new DomainError('STEPUP_REQUIRED');
}

function mapReason(reason: string): 'STEPUP_REQUIRED' | 'MEMBERSHIP_INACTIVE' | 'SCOPE_DENIED' | 'PERMISSION_DENIED' {
  if (reason === 'STEPUP_REQUIRED') return 'STEPUP_REQUIRED';
  if (reason === 'MEMBERSHIP_INACTIVE' || reason === 'ACCESS_VERSION_STALE') return 'MEMBERSHIP_INACTIVE';
  if (reason === 'SCOPE_DENIED' || reason === 'SCOPE_KIND_DENIED') return 'SCOPE_DENIED';
  return 'PERMISSION_DENIED';
}
