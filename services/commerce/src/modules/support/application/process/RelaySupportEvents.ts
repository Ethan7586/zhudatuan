import { COMMERCE_EVENTS } from '@shop/contract';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { RealtimePort, SupportReplayPort } from '../port/RealtimePort';
import type { OutboxRelayPort } from '../../../runtime/public';
import type { SupportJobExecution } from './RunSupportJob';

const supportEvents: ReadonlySet<string> = new Set(COMMERCE_EVENTS.filter(({ module }) => module === 'support').map(({ type }) => type));

export class RelaySupportEvents {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly outbox: OutboxRelayPort,
    private readonly realtime: RealtimePort,
    private readonly replay: SupportReplayPort
  ) {}

  async execute(id: string, execution: SupportJobExecution): Promise<void> {
    const event = await this.transactions.write(options(execution), async (context) => {
      const claimed = await this.outbox.claim(context, { event: id, worker: execution.trace, prefix: 'support.' });
      return claimed ? this.replay.authoritative(context, claimed) : null;
    });
    if (!event) return;
    if (!supportEvents.has(event.type)) throw new Error('SUPPORT_RELAY_EVENT_UNDECLARED');
    try {
      const cursor = await this.realtime.publish(event);
      await this.transactions.write(options(execution), (context) => this.outbox.complete(context, { event: id, cursor, worker: execution.trace }));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message.slice(0, 120) : 'SUPPORT_RELAY_FAILED';
      await this.transactions.write(options(execution), (context) => this.outbox.fail(context, { event: id, worker: execution.trace, reason }));
      throw cause;
    }
  }
}

function options(execution: SupportJobExecution) {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:supportrelay',
    trace: execution.trace,
    operation: 'job.support.supportrelay',
    workload: 'jobs' as const,
    signal: execution.signal,
    deadline: execution.deadline,
  };
}
