import { DomainError } from '../platform/error/DomainError';
import { isOperationTarget, type Operation } from '@shop/contract';
import type { Scope } from '@shop/authz';
import { token } from '../composition/Container';
import type { Actor } from '../platform/security/AccessContext';
import type { AccessPipeline } from './AccessPipeline';
import type { DecisionSink } from '../platform/security/DecisionSink';
import type { ClientTarget, OperationSecurityContext } from '../platform/security/OperationSecurityContext';
import type { PreauthResolver } from '../platform/security/PreauthResolver';
import { assertRiskAllowed, type RiskGate } from '../platform/security/RiskGate';
import { ResourceResolver } from './ResourceResolver';

export interface OperationPolicyInput {
  readonly operation: Operation;
  readonly input: Readonly<object>;
  readonly headers: Readonly<Record<string, string>>;
  readonly deadline: number;
  readonly signal: AbortSignal;
}

export interface OperationPolicy {
  authorize(input: OperationPolicyInput): Promise<OperationSecurityContext>;
}

export const OPERATION_POLICY = token<OperationPolicy>('operation.policy');

export class SecureOperationPolicy implements OperationPolicy {
  constructor(
    private readonly access: AccessPipeline,
    private readonly preauth: PreauthResolver,
    private readonly risk: RiskGate,
    private readonly decisions: DecisionSink,
    private readonly resources = new ResourceResolver()
  ) {}

  async authorize({ operation, input, headers, deadline, signal }: OperationPolicyInput): Promise<OperationSecurityContext> {
    if (operation.assuranceLevel === 'preauth') {
      const context = await this.preauth.resolve(headers, operation);
      await this.authorizePublic(operation, headers, context.principal ?? `preauth:${context.id}`, context.target, context.trace, deadline, signal);
      return context;
    }
    if (operation.assuranceLevel === 'anonymous' || operation.audience === 'system' || operation.audience === 'webhook') {
      const channel = operation.audience === 'system' ? 'system' : operation.audience === 'webhook' ? 'webhook' : 'public';
      const requested = headers['x-client-target'];
      const target = isOperationTarget(requested) ? requested : null;
      assertTarget(operation, target);
      const trace = headers['x-trace-id'] ?? headers['x-request-id'] ?? `anonymous:${operation.id}`;
      if (channel === 'public' && target !== null) await this.authorizePublic(operation, headers, `anonymous:${target}`, target, trace, deadline, signal);
      return Object.freeze({ kind: 'anonymous', channel, target, trace });
    }
    if (operation.assuranceLevel === 'optional') {
      const target = exactBrowserTarget(operation, headers);
      if (hasSessionCredential(headers, target)) {
        const resource = this.resources.resolve(operation, input);
        const access = await this.access.authorize(headers, operation.id, operation.permission, deadline, signal, resource);
        return Object.freeze({ kind: 'session', access });
      }
      const trace = headers['x-trace-id'] ?? headers['x-request-id'] ?? `anonymous:${operation.id}`;
      await this.authorizePublic(operation, headers, `anonymous:${target}`, target, trace, deadline, signal);
      return Object.freeze({ kind: 'anonymous', channel: 'public', target, trace });
    }
    const resource = this.resources.resolve(operation, input);
    const access = await this.access.authorize(headers, operation.id, operation.permission, deadline, signal, resource);
    return Object.freeze({ kind: 'session', access });
  }

  private async authorizePublic(operation: Operation, headers: Readonly<Record<string, string>>, principal: string, target: ClientTarget, trace: string, deadline: number, signal: AbortSignal): Promise<void> {
    const actor: Actor = Object.freeze({ id: principal, session: trace, membership: 'public', credentialVersion: 0, accessVersion: 0, target, assurance: { level: 0 } });
    try {
      const assessment = await this.risk.evaluate({
        actor,
        operation: operation.id,
        scope: PUBLIC_SCOPE,
        trace,
        deadline,
        signal,
        signals: { anonymous: principal.startsWith('anonymous:') ? 1 : 0, device: headers['x-device-id'] === undefined ? 1 : 0 },
      });
      assertRiskAllowed(assessment.outcome);
      await this.decisions.append({ actor, operation: operation.id, scope: PUBLIC_SCOPE, outcome: 'allow', reason: 'POLICY_ALLOWED', trace, deadline, signal });
    } catch (cause) {
      await this.decisions.append({ actor, operation: operation.id, scope: PUBLIC_SCOPE, outcome: 'deny', reason: 'RISK_DENIED', trace, deadline, signal });
      throw cause;
    }
  }
}

function exactBrowserTarget(operation: Operation, headers: Readonly<Record<string, string>>): ClientTarget {
  const requested = headers['x-client-target'];
  if (!isOperationTarget(requested)) throw new DomainError('AUTHORIZATION_DENIED');
  assertTarget(operation, requested);
  return requested;
}

function hasSessionCredential(headers: Readonly<Record<string, string>>, target: ClientTarget): boolean {
  if (/^Bearer\s+/i.test(headers.authorization ?? '')) return true;
  const expected = `__Host-${target}-session=`;
  return (headers.cookie ?? '').split(';').some((part) => part.trim().startsWith(expected));
}

const PUBLIC_SCOPE: Scope = Object.freeze({ kind: 'platform', id: 'organization-platform-root', path: Object.freeze([]) });

function assertTarget(operation: Operation, target: ClientTarget | null): void {
  const targets = operation.targets as readonly string[];
  if (targets.length === 0 ? target !== null : target === null || !targets.includes(target)) throw new DomainError('AUTHORIZATION_DENIED');
}
