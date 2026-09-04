import type { TransactionalEventWriter } from '../../../../foundation/application/OperationExecutor';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import { qualificationExpiredEvent } from '../../domain/event/QualificationEvents';
import { QualificationCase } from '../../domain/model/QualificationCase';
import type { QualificationCaseRepository } from '../port/QualificationCaseRepository';

export interface QualificationExpiryRequest {
  readonly qualification: string;
  readonly scope: string;
  readonly version: number;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ExpireQualification {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly cases: QualificationCaseRepository,
    private readonly outbox: TransactionalEventWriter
  ) {}

  execute(request: QualificationExpiryRequest): Promise<void> {
    if (request.signal.aborted) throw request.signal.reason ?? new Error('JOB_ABORTED');
    return this.transactions.write(
      {
        tenant: request.scope,
        membership: '',
        scope: request.scope,
        actor: 'job:qualificationexpiry',
        trace: request.trace,
        operation: 'job.qualification.expiry',
        workload: 'jobs',
        signal: request.signal,
        deadline: request.deadline,
      },
      async (context) => {
        const current = await this.cases.lock(context, request.scope, request.qualification);
        if (!current || current.version !== request.version) return;
        const expired = QualificationCase.restore(current).expire(new Date().toISOString());
        if (!expired) return;
        const snapshot = expired.snapshot();
        if (!(await this.cases.save(context, snapshot, request.version))) throw new Error('QUALIFICATION_EXPIRY_VERSION_CONFLICT');
        await this.outbox.append(context, qualificationExpiredEvent(snapshot, { actor: 'job:qualificationexpiry', trace: request.trace }));
      }
    );
  }
}
