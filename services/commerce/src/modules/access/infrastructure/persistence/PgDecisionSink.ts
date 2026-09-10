import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { AccessDecision, DecisionSink } from '../../../../platform/security/DecisionSink';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { SessionSecurity } from '../../../../platform/security/SessionSecurity';
import type { DatabasePool } from '../../../../platform/database/Pool';
import { pgContextParameters, pgContextValues } from '../../../../platform/database/PgContext';

export class PgDecisionSink implements DecisionSink {
  private readonly commands: DatabasePool;
  constructor(
    pool: DatabasePool,
    private readonly manager: TransactionManager,
    private readonly sessions: SessionSecurity,
    private readonly transactions = new PgTransactionAccess()
  ) {
    this.commands = pool.workload('command');
  }

  async append(decision: AccessDecision): Promise<void> {
    const values = decisionValues(decision, `decision:${randomUUID()}`);
    if (decision.reason !== 'RISK_DENIED' && decision.reason !== 'RISK_REVIEW_REQUIRED') {
      try {
        available(decision);
        const options = transactionOptions(decision);
        await this.commands.query(
          `with request_context as materialized (${pgContextParameters(1)})
          insert into access.decisionaudit(id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at)
          select $10,$11,$12,$13,$14,$15,$16,'1',$17,clock_timestamp() from request_context on conflict(id) do nothing`,
          [...pgContextValues(options), ...values]
        );
        return;
      } catch (cause) {
        if (decision.signal.aborted || decision.deadline <= Date.now()) throw cause;
      }
    }
    await this.manager.write(
      transactionOptions(decision),
      async (context) => {
        const database = this.transactions.database(context);
        await database.query(
          `insert into access.decisionaudit(id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at)
        values($1,$2,$3,$4,$5,$6,$7,'1',$8,clock_timestamp()) on conflict(id) do nothing`,
          values
        );
        if (decision.reason === 'RISK_DENIED' || decision.reason === 'RISK_REVIEW_REQUIRED') {
          await this.sessions.invalidate(context, decision.actor.id, 'risk_event');
        }
      }
    );
  }
}

function transactionOptions(decision: AccessDecision) {
  return Object.freeze({
    tenant: decision.scope?.tenant ?? '',
    membership: decision.actor.membership,
    scope: decision.scope?.id ?? 'authorization',
    actor: decision.actor.id,
    trace: decision.trace,
    operation: decision.operation,
    deadline: decision.deadline,
    signal: decision.signal,
  });
}

function decisionValues(decision: AccessDecision, id: string): readonly unknown[] {
  return Object.freeze([
    id,
    decision.actor.id,
    decision.operation,
    decision.resource ?? null,
    decision.scope?.id ?? null,
    decision.outcome,
    decision.reason,
    decision.trace,
  ]);
}

function available(decision: AccessDecision): void {
  if (decision.signal.aborted) throw decision.signal.reason ?? new Error('DECISION_AUDIT_ABORTED');
  if (!Number.isFinite(decision.deadline) || decision.deadline <= Date.now()) throw new Error('DEADLINE_EXCEEDED');
}
