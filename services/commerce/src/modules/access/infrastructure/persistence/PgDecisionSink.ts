import { randomUUID } from 'node:crypto';
import type { AccessDecision, DecisionSink } from '../../../../foundation/security/DecisionSink';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';
import type { SessionSecurity } from '../../../../foundation/security/SessionSecurity';

export class PgDecisionSink implements DecisionSink {
  constructor(
    private readonly pool: DatabasePool,
    private readonly sessions: SessionSecurity
  ) {}

  async append(decision: AccessDecision): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyApiDatabaseContext(client, { tenant: decision.scope?.tenant ?? '', membership: decision.actor.membership, scope: decision.scope?.id ?? 'authorization', actor: decision.actor.id, trace: decision.trace });
      await client.query(
        `insert into access.decisionaudit(id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at)
        values($1,$2,$3,$4,$5,$6,$7,'1',$8,clock_timestamp())`,
        [`decision:${randomUUID()}`, decision.actor.id, decision.operation, decision.resource ?? null, decision.scope?.id ?? null, decision.outcome, decision.reason, decision.trace]
      );
      if (decision.reason === 'RISK_DENIED' || decision.reason === 'RISK_REVIEW_REQUIRED') {
        await this.sessions.invalidate(client, decision.actor.id, 'risk_event');
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}
