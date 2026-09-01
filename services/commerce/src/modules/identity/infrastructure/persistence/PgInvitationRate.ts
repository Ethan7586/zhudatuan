import type { Telemetry } from '@shop/telemetry';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { InvitationRateInput, InvitationRatePort } from '../../application/port/InvitationRatePort';

export class PgInvitationRate implements InvitationRatePort {
  constructor(
    private readonly manager: TransactionManager,
    private readonly telemetry: Telemetry,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async consume(input: Parameters<InvitationRatePort['consume']>[0]): Promise<void> {
    await this.manager.write(
      {
        tenant: '',
        membership: 'public',
        scope: 'organization-platform-root',
        actor: input.actor,
        trace: input.trace,
        operation: input.operation,
        deadline: input.deadline,
        signal: input.signal,
      },
      (context) => this.consumeWithin(context, input)
    );
  }

  async consumeWithin(context: WriteTransactionContext, input: InvitationRateInput): Promise<void> {
    try {
      const database = this.transactions.database(context);
      for (const rule of input.rules) {
        assertRule(rule);
        const result = await database.query<{ failures: number }>(
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
    } catch (cause) {
      if (cause instanceof DomainError && cause.code === 'RATE_LIMITED') {
        this.telemetry.metrics.count('identity_invitation_rate_limited_total', 1, {
          requestId: input.trace,
          traceId: input.trace,
          module: 'identity',
          operation: input.operation,
          result: 'denied',
        });
      }
      throw cause;
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
