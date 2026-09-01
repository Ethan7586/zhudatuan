import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { SupportJobRepository } from '../port/SupportJobRepository';

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
    private readonly objects: ObjectStore
  ) {}

  async scan(id: string, execution: SupportJobExecution): Promise<void> {
    const options = this.options(execution, 'supportscan');
    const item = await this.transactions.read(options, (context) => this.repository.evidence(context, id));
    if (!item) return;
    let valid = false;
    try {
      const metadata = await this.objects.inspect(item.objectReference);
      valid =
        metadata.sha256 === item.sha256 &&
        metadata.size === item.size &&
        metadata.contentType === item.contentType &&
        metadata.size <= 10 * 1024 * 1024 &&
        ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'].includes(metadata.contentType);
    } catch {
      valid = false;
    }
    await this.transactions.write(options, (context) => this.repository.completeEvidence(context, id, valid));
  }

  escalate(ticket: string, reason: 'response' | 'resolution', execution: SupportJobExecution): Promise<void> {
    const options = this.options(execution, 'supportsla');
    return this.transactions.write(options, (context) => this.repository.escalate(context, ticket, reason));
  }

  private options(execution: SupportJobExecution, kind: 'supportsla' | 'supportscan'): TransactionOptions {
    return {
      tenant: execution.scope,
      membership: '',
      scope: execution.scope,
      actor: `job:${kind}`,
      trace: execution.trace,
      operation: `job.support.${kind}`,
      workload: 'jobs',
      signal: execution.signal,
      deadline: execution.deadline,
    };
  }
}
