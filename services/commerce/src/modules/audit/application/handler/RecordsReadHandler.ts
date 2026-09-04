import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../../../foundation/application/Validation';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { AuditFieldPolicy, type AuditDetail } from '../../domain/policy/AuditFieldPolicy';
import type { AuditHistoryRepository } from '../port/AuditHistoryRepository';

export class RecordsReadHandler implements OperationHandler<'audit.records.read', 'read'> {
  readonly operation = 'audit.records.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly history: AuditHistoryRepository,
    private readonly audit: AuditSink,
    private readonly fields = new AuditFieldPolicy()
  ) {}

  async execute(input: OperationInputFor<'audit.records.read'>, context: HandlerContext<'audit.records.read'>): Promise<OperationReply<OperationOutputFor<'audit.records.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 200);
    const detail = this.detail(input.query?.detail, access.assurance.level);
    const position = auditPosition(page.sort);
    const watermark = position?.watermark ?? new Date().toISOString();
    const rows = await this.history.records(context.transaction, access.scope.id, { sort: position?.occurred ?? null, id: page.id }, watermark, page.fetch);
    const more = rows.length > page.limit;
    const selected = more ? rows.slice(0, page.limit) : rows;
    const items = selected.map((row) => project(row, detail));
    const last = selected.at(-1);
    const next = more && last ? encodeCursor({ sort: JSON.stringify({ watermark, occurred: last.occurred_at }), id: last.id }) : null;
    if (detail === 'evidence') {
      await this.audit.access(requireWriteTransaction(context.transaction), {
        actor: access.actor.id,
        actorType: access.actor.target,
        scope: access.scope.id,
        request: context.requestId,
        operation: this.operation,
        subject: Object.freeze({ type: 'actor', id: access.actor.id }),
        object: Object.freeze({ type: 'audit', id: `audit:records:${watermark}` }),
        outcome: 'succeeded',
        reason: 'sensitive-evidence-read',
        fields: Object.freeze({ selected: this.fields.fields(detail), count: items.length, watermark }),
        trace: context.traceId,
      });
    }
    return { status: 200, body: { items: [...items], count: items.length, next, watermark, detail } as OperationOutputFor<'audit.records.read'> };
  }

  private detail(requested: unknown, assurance: number): AuditDetail {
    try {
      return this.fields.authorize(requested, assurance);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'AUDIT_EVIDENCE_ASSURANCE_REQUIRED') throw new DomainError('STEPUP_REQUIRED');
      throw new DomainError('VALIDATION_FAILED');
    }
  }
}

function auditPosition(value: string | null): Readonly<{ watermark: string; occurred: string }> | null {
  if (value === null) return null;
  try {
    const position = JSON.parse(value) as Readonly<Record<string, unknown>>;
    if (typeof position.watermark !== 'string' || typeof position.occurred !== 'string' || !Number.isFinite(Date.parse(position.watermark)) || !Number.isFinite(Date.parse(position.occurred))) throw new Error('INVALID');
    return Object.freeze({ watermark: position.watermark, occurred: position.occurred });
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
}

function project(row: Readonly<Record<string, unknown>>, detail: AuditDetail): Readonly<Record<string, unknown>> {
  const evidence = detail === 'evidence';
  return Object.freeze({
    id: row.id,
    kind: row.kind,
    scope_id: row.scope_id,
    actor_id: evidence ? row.actor_id : masked(row.actor_id),
    actor_type: row.actor_type,
    request_id: evidence ? row.request_id : null,
    operation: row.operation,
    subject_type: row.subject_type,
    subject_id: evidence ? row.subject_id : masked(row.subject_id),
    object_type: row.object_type,
    object_id: evidence ? row.object_id : masked(row.object_id),
    outcome: row.outcome,
    reason: row.reason,
    before_hash: row.before_hash,
    after_hash: row.after_hash,
    evidence: evidence ? row.evidence : null,
    trace_id: evidence ? row.trace_id : null,
    previous_hash: evidence ? row.previous_hash : null,
    record_hash: row.record_hash,
    occurred_at: row.occurred_at,
  });
}

function masked(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? `····${value.slice(-4)}` : null;
}
