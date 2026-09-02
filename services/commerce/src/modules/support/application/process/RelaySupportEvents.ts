import { COMMERCE_EVENTS } from '@shop/contract';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { RealtimePort, SupportRealtimeEvent } from '../port/RealtimePort';
import type { OutboxRelayPort } from '../../../runtime/public';
import type { SupportJobExecution } from './RunSupportJob';

const supportEvents: ReadonlySet<string> = new Set(COMMERCE_EVENTS.filter(({ module }) => module === 'support').map(({ type }) => type));

export class RelaySupportEvents {
  constructor(private readonly transactions: TransactionManager, private readonly outbox: OutboxRelayPort, private readonly realtime: RealtimePort) {}

  async execute(id: string, execution: SupportJobExecution): Promise<void> {
    const event = await this.transactions.write(options(execution), (context) => this.outbox.claim(context, { event: id, worker: execution.trace, prefix: 'support.' }));
    if (!event) return;
    if (!supportEvents.has(event.type)) throw new Error('SUPPORT_RELAY_EVENT_UNDECLARED');
    const output = Object.freeze({
      id: event.id,
      type: event.type,
      scopeId: event.scope,
      ticketId: text(event.payload.ticketId) ?? event.aggregate,
      conversationId: text(event.payload.conversationId) ?? event.aggregate,
      ...(text(event.payload.memberId) === null ? {} : { memberId: text(event.payload.memberId)! }),
      ...(typeof event.payload.messageId === 'string' ? { messageId: event.payload.messageId } : {}),
      ...(typeof event.payload.evidenceId === 'string' ? { evidenceId: event.payload.evidenceId } : {}),
      ...(Number.isSafeInteger(event.payload.sequence) ? { sequence: Number(event.payload.sequence) } : {}),
      ...(Number.isSafeInteger(event.payload.version) ? { version: Number(event.payload.version) } : {}),
      occurredAt: event.occurredAt,
    }) as SupportRealtimeEvent;
    try {
      const cursor = await this.realtime.publish(output);
      await this.transactions.write(options(execution), (context) => this.outbox.complete(context, { event: id, cursor, worker: execution.trace }));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message.slice(0, 120) : 'SUPPORT_RELAY_FAILED';
      await this.transactions.write(options(execution), (context) => this.outbox.fail(context, { event: id, worker: execution.trace, reason }));
      throw cause;
    }
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function options(execution: SupportJobExecution) {
  return { tenant: execution.scope, membership: '', scope: execution.scope, actor: 'job:supportrelay', trace: execution.trace, operation: 'job.support.supportrelay', workload: 'jobs' as const, signal: execution.signal, deadline: execution.deadline };
}
