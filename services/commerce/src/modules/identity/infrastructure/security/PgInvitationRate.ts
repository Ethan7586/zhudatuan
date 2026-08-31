import type { Telemetry } from '@shop/telemetry';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { InvitationRatePort } from '../../application/port/InvitationRatePort';

export class PgInvitationRate implements InvitationRatePort {
  constructor(
    private readonly pool: DatabasePool,
    private readonly telemetry: Telemetry
  ) {}

  async consume(input: Parameters<InvitationRatePort['consume']>[0]): Promise<void> {
    const client = await this.pool.workload('command').connect();
    try {
      await client.query('begin');
      await applyApiDatabaseContext(client, { tenant: '', membership: 'public', scope: 'organization-platform-root', actor: input.actor, trace: input.trace, operation: input.operation });
      for (const rule of input.rules) {
        assertRule(rule);
        const result = await client.query<{ failures: number }>(
          `insert into identity.loginattempt
          (subject_hash,client_hash,window_started_at,failures,locked_until) values($1,$2,clock_timestamp(),1,null)
          on conflict(subject_hash,client_hash) do update set
            failures=case when identity.loginattempt.window_started_at<clock_timestamp()-make_interval(secs=>$3) then 1
              else identity.loginattempt.failures+1 end,
            window_started_at=case when identity.loginattempt.window_started_at<clock_timestamp()-make_interval(secs=>$3)
              then clock_timestamp() else identity.loginattempt.window_started_at end
          returning failures`,
          [rule.fingerprint, rule.bucket, rule.windowSeconds]
        );
        if ((result.rows[0]?.failures ?? rule.maximum + 1) > rule.maximum) throw new DomainError('RATE_LIMITED');
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      if (cause instanceof DomainError && cause.code === 'RATE_LIMITED')
        this.telemetry.metrics.count('identity_invitation_rate_limited_total', 1, { requestId: input.trace, traceId: input.trace, module: 'identity', operation: input.operation, result: 'denied' });
      throw cause;
    } finally {
      client.release();
    }
  }
}

function assertRule(rule: Parameters<InvitationRatePort['consume']>[0]['rules'][number]): void {
  if (
    !/^[0-9a-f]{64}$/.test(rule.fingerprint) ||
    !/^[0-9a-f]{64}$/.test(rule.bucket) ||
    !Number.isSafeInteger(rule.maximum) ||
    rule.maximum < 1 ||
    rule.maximum > 10_000 ||
    !Number.isSafeInteger(rule.windowSeconds) ||
    rule.windowSeconds < 60 ||
    rule.windowSeconds > 86_400
  ) {
    throw new Error('INVITATION_RATE_RULE_INVALID');
  }
}
