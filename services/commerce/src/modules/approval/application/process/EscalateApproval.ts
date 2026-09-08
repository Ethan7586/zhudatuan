import type { TransactionalEventWriter } from '../../../../pipeline/OperationExecutor';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import { approvalEvent } from '../../domain/event/ApprovalEvents';
import { EscalationPolicy } from '../../domain/policy/EscalationPolicy';
import type { ApprovalRepository } from '../port/ApprovalRepository';

export class EscalateApproval {
  private readonly policy = new EscalationPolicy();

  constructor(
    private readonly transactions: TransactionManager,
    private readonly approvals: ApprovalRepository,
    private readonly outbox: TransactionalEventWriter
  ) {}

  async execute(signal: AbortSignal, deadline: number, limit = 100): Promise<void> {
    const due = await this.transactions.read(this.options('approval', signal, deadline, 'scan'), (context) => this.approvals.dueTasks(context, limit));
    for (const candidate of due) {
      if (signal.aborted) throw signal.reason;
      await this.transactions.write(this.options(candidate.instance.scopeId, signal, deadline, candidate.task.id), async (context) => {
        const action = this.policy.next(new Date(), candidate.task.dueAt === null ? null : new Date(candidate.task.dueAt), candidate.escalation.action);
        if (action === 'waiting') return;
        const result = await this.approvals.escalateTask(context, {
          taskId: candidate.task.id,
          instanceId: candidate.instance.id,
          action,
          ...(candidate.escalation.target === undefined ? {} : { target: candidate.escalation.target }),
          expectedVersion: candidate.task.version,
          actorId: 'job:approvalescalation',
        });
        if (!result) return;
        const occurredAt = new Date().toISOString();
        await this.outbox.append(
          context,
          approvalEvent({
            type: 'approval.task.escalated',
            aggregateType: 'approvaltask',
            aggregateId: result.task.id,
            aggregateVersion: result.task.version,
            scopeId: result.instance.scopeId,
            actorId: 'job:approvalescalation',
            traceId: context.trace,
            occurredAt,
            payload: {
              taskId: result.task.id,
              instanceId: result.instance.id,
              action,
              ...(candidate.escalation.target === undefined ? {} : { target: candidate.escalation.target }),
              escalatedAt: occurredAt,
            },
          })
        );
        if (result.instance.state === 'expired') {
          await this.outbox.append(
            context,
            approvalEvent({
              type: 'approval.instance.expired',
              aggregateType: 'approvalinstance',
              aggregateId: result.instance.id,
              aggregateVersion: result.instance.version,
              scopeId: result.instance.scopeId,
              actorId: 'job:approvalescalation',
              traceId: context.trace,
              occurredAt,
              payload: { instanceId: result.instance.id, subjectKind: result.instance.subjectKind, subjectId: result.instance.subjectId, expiredAt: occurredAt },
            })
          );
        }
      });
    }
  }

  private options(scope: string, signal: AbortSignal, deadline: number, trace: string) {
    return {
      tenant: scope,
      membership: '',
      scope,
      actor: 'job:approvalescalation',
      trace: `approvalescalation:${trace}`,
      operation: 'job.approval.escalation',
      workload: 'jobs' as const,
      signal,
      deadline,
    };
  }
}
