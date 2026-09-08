import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { AttachmentScanPort } from '../port/AttachmentScanPort';
import type { SupportJobRepository } from '../port/SupportJobRepository';
import type { EvaluateSla } from './EvaluateSla';
import type { RelaySupportEvents } from './RelaySupportEvents';

export interface SupportJobExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class RunSupportJob {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: SupportJobRepository,
    private readonly scanner: AttachmentScanPort,
    private readonly sla: EvaluateSla,
    private readonly relay: RelaySupportEvents
  ) {}

  async scan(id: string, execution: SupportJobExecution): Promise<void> {
    const options = this.options(execution, 'supportscan');
    const item = await this.transactions.read(options, (context) => this.repository.evidence(context, id));
    if (!item) return;
    const result = await this.scanner.scan(item);
    await this.transactions.write(options, (context) => this.repository.completeEvidence(context, item, result));
  }

  escalate(ticket: string, reason: 'response' | 'resolution', execution: SupportJobExecution): Promise<void> {
    return this.sla.execute(ticket, reason, execution);
  }

  relayEvent(event: string, execution: SupportJobExecution): Promise<void> {
    return this.relay.execute(event, execution);
  }

  reassign(agent: string, cursor: string | null, execution: SupportJobExecution): Promise<void> {
    return this.transactions.write(this.options(execution, 'supportreassign'), (context) => this.repository.reassign(context, agent, cursor));
  }

  private options(execution: SupportJobExecution, kind: 'supportscan' | 'supportreassign'): TransactionOptions {
    return { tenant: execution.scope, membership: '', scope: execution.scope, actor: `job:${kind}`, trace: execution.trace, operation: `job.support.${kind}`, workload: 'jobs', signal: execution.signal, deadline: execution.deadline };
  }
}
