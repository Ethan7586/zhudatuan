import { createHash, randomUUID } from 'node:crypto';
import { OperationCatalog, type OperationId } from '@shop/contract';
import { Redactor } from '@shop/telemetry';
import type { AuditSink } from './AuditSink';
import type { OperationRequest, OperationResult } from './OperationExecution';
import type { OperationDatabase } from './ModuleOperations';
import { sessionAccess } from '../security/OperationSecurityContext';

const IDENTITY_INPUTS: Readonly<Partial<Record<OperationId, readonly string[]>>> = Object.freeze({
  'identity.sessions.create': Object.freeze(['method', 'target']),
  'identity.sessions.complete': Object.freeze([]),
  'identity.tickets.exchange': Object.freeze([]),
  'identity.challenges.create': Object.freeze(['purpose']),
  'identity.invitations.resolve': Object.freeze(['target']),
  'identity.invitations.read': Object.freeze([]),
  'identity.enrollments.read': Object.freeze([]),
  'identity.enrollments.complete': Object.freeze(['termsAccepted', 'termsHash']),
  'identity.members.manage': Object.freeze(['action', 'status', 'departmentId']),
  'identity.password.change': Object.freeze([]),
  'identity.password.verify': Object.freeze([]),
  'identity.password.reset': Object.freeze([]),
  'identity.mobile.manage': Object.freeze([]),
  'identity.stepup.start': Object.freeze([]),
  'identity.stepup.complete': Object.freeze([]),
});

const IDENTITY_OUTPUTS: Readonly<Partial<Record<OperationId, readonly string[]>>> = Object.freeze({
  'identity.invitations.create': Object.freeze(['code']),
  'identity.tickets.exchange': Object.freeze(['proof']),
  'identity.stepup.complete': Object.freeze(['proof']),
});

export async function appendOperationAudit(audit: AuditSink, client: OperationDatabase, request: OperationRequest, module: string, result: OperationResult, actor: string, scope: string, requestHashValue: string): Promise<void> {
  const body = request.input.body && typeof request.input.body === 'object' && !Array.isArray(request.input.body) ? (request.input.body as Record<string, unknown>) : {};
  const operation = OperationCatalog.get(request.type);
  const redactor = new Redactor();
  const auditBody = operation.module === 'observability' ? { redacted: true } : project(request.input.body, IDENTITY_INPUTS[operation.id]);
  const before = redactor.redact({ path: request.input.path, query: request.input.query, body: auditBody, expectedVersion: request.input.expectedVersion ?? null });
  const after = redactor.redact(redact(result.body, IDENTITY_OUTPUTS[operation.id]) ?? null);
  const sensitive = IDENTITY_INPUTS[operation.id] !== undefined;
  const requestHash = sensitive ? digest(JSON.stringify({ operation: operation.id, before })) : requestHashValue;
  const rawReason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
  const access = sessionAccess(request.security);
  await audit.record(client, {
    scope,
    actor,
    actorType: access?.actor.target ?? 'public',
    action: request.type,
    resourceType: module,
    resource: Object.values(request.input.path)[0] ?? null,
    before,
    after,
    evidence: {
      status: result.status,
      idempotency: sensitive ? '[REDACTED]' : request.input.idempotency,
      requestHash,
      reason: sensitive || rawReason === null ? null : redactor.redact(rawReason, 'reason'),
      permission: operation.permission ?? null,
      capabilities: [...(access?.capabilities ?? [])],
    },
    trace: sensitive ? `audit:${randomUUID()}` : (access?.trace ?? requestHashValue),
  });
}

function project(value: unknown, allowlist: readonly string[] | undefined): unknown {
  if (allowlist === undefined) return value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { redacted: true };
  const record = value as Record<string, unknown>;
  return Object.fromEntries([...allowlist.filter((key) => Object.hasOwn(record, key)).map((key) => [key, scalar(record[key])] as const), ['redacted', true] as const]);
}

function scalar(value: unknown): unknown {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value) ? value : '[REDACTED]';
}

function redact(value: unknown, fields: readonly string[] | undefined): unknown {
  if (fields === undefined || value === null || typeof value !== 'object') return value;
  const names = new Set(fields);
  if (Array.isArray(value)) return value.map((item) => redact(item, fields));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, names.has(key) ? '[REDACTED]' : redact(item, fields)]));
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
