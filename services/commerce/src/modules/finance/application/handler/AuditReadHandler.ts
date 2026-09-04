import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { AuditReadPort } from '../../../audit/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { EventEvidenceReadPort } from '../../../runtime/public';
import type { AuditProjectionRepository } from '../port/AuditProjectionRepository';

type AuditOutput = OperationOutputFor<'finance.audit.read'>;

export class AuditReadHandler implements OperationHandler<'finance.audit.read', 'read'> {
  readonly operation = 'finance.audit.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly projection: AuditProjectionRepository,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants'>,
    private readonly events: EventEvidenceReadPort,
    private readonly audit: AuditReadPort
  ) {}

  async execute(input: OperationInputFor<'finance.audit.read'>, context: HandlerContext<'finance.audit.read'>): Promise<OperationReply<AuditOutput>> {
    const access = requireSession(context.security);
    const reference = input.query?.reference;
    if (typeof reference !== 'string' || reference.trim().length === 0) throw new DomainError('VALIDATION_FAILED');
    const normalized = reference.trim();
    const scopes = await this.organizations.descendants(context.transaction, access.scope.id);
    const projection = await this.projection.read(context.transaction, scopes, normalized);
    if (projection.facts.length === 0) throw new DomainError('RESOURCE_NOT_FOUND');
    const events = await this.events.events(context.transaction, scopes, projection.resources);
    const traces = Object.freeze([...new Set(events.map((event) => event.traceId))]);
    const records = await this.audit.records(context.transaction, {
      scopes,
      references: [...projection.resources.map((id) => ({ kind: 'object' as const, id })), ...traces.map((id) => ({ kind: 'trace' as const, id }))],
    });
    return {
      status: 200,
      body: Object.freeze({
        reference: normalized,
        facts: [...projection.facts],
        events: events.map((event) => ({ id: event.id, type: event.type, event_version: event.eventVersion, aggregate_type: event.aggregateType, aggregate_id: event.aggregateId, state: event.state, occurred_at: event.occurredAt, trace_id: event.traceId })),
        records: records.map((record) => ({ id: record.id, kind: record.kind, action: record.operation, resource_type: record.object.type, resource_id: record.object.id, actor_id: record.actor.id, actor_type: record.actor.type, before_hash: record.beforeHash, after_hash: record.afterHash, record_hash: record.recordHash, evidence: record.evidence, occurred_at: record.occurredAt, trace_id: record.trace })),
        watermark: watermark(projection.facts.map((fact) => fact.occurred_at), events.map((event) => event.occurredAt), records.map((record) => record.occurredAt)),
      }) as AuditOutput,
    };
  }
}

function watermark(...groups: readonly (readonly (string | null)[])[]): string | null {
  return groups.flat().filter((value): value is string => value !== null).sort().at(-1) ?? null;
}
