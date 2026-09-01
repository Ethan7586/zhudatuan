import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { AccessDecision, DecisionSink } from '../../../../foundation/security/DecisionSink';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { SessionSecurity } from '../../../../foundation/security/SessionSecurity';

export class PgDecisionSink implements DecisionSink {
  constructor(
    private readonly manager: TransactionManager,
    private readonly sessions: SessionSecurity,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async append(decision: AccessDecision): Promise<void> {
    await this.manager.write(
      {
        tenant: decision.scope?.tenant ?? '',
        membership: decision.actor.membership,
        scope: decision.scope?.id ?? 'authorization',
        actor: decision.actor.id,
        trace: decision.trace,
        operation: decision.operation,
        deadline: decision.deadline,
        signal: decision.signal,
      },
      async (context) => {
        const database = this.transactions.database(context);
        await database.query(
          `insert into access.decisionaudit(id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at)
        values($1,$2,$3,$4,$5,$6,$7,'1',$8,clock_timestamp())`,
          [`decision:${randomUUID()}`, decision.actor.id, decision.operation, decision.resource ?? null, decision.scope?.id ?? null, decision.outcome, decision.reason, decision.trace]
        );
        if (decision.reason === 'RISK_DENIED' || decision.reason === 'RISK_REVIEW_REQUIRED') {
          await this.sessions.invalidate(context, decision.actor.id, 'risk_event');
        }
      }
    );
  }
}
