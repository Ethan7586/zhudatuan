import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { FulfillmentFailurePolicy } from '../../domain/policy/FulfillmentFailurePolicy';

export class PgFulfillmentSaga {
  private readonly failures = new FulfillmentFailurePolicy();
  async begin(database: SqlExecutor, fulfillment: string, step: string, key: string, checkpoint: Readonly<Record<string, unknown>> = {}): Promise<boolean> {
    const result = await database.query(
      `insert into fulfillment.sagastep(fulfillment_id,step,idempotency_key,state,attempts,error_code,checkpoint,next_attempt_at,started_at,completed_at,updated_at,version)
      values($1,$2,$3,'running',1,null,$4::jsonb,null,clock_timestamp(),null,clock_timestamp(),0)
      on conflict(fulfillment_id,step) do update set state='running',attempts=fulfillment.sagastep.attempts+1,error_code=null,
        checkpoint=fulfillment.sagastep.checkpoint||excluded.checkpoint,next_attempt_at=null,started_at=clock_timestamp(),updated_at=clock_timestamp(),
        version=fulfillment.sagastep.version+1 where fulfillment.sagastep.state<>'succeeded' returning state`,
      [fulfillment, step, key, JSON.stringify(checkpoint)]
    );
    return result.rows[0] !== undefined;
  }

  async succeed(database: SqlExecutor, fulfillment: string, step: string, checkpoint: Readonly<Record<string, unknown>> = {}): Promise<void> {
    const changed = await database.query(
      `update fulfillment.sagastep set state='succeeded',checkpoint=checkpoint||$3::jsonb,error_code=null,next_attempt_at=null,
      completed_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where fulfillment_id=$1 and step=$2 and state='running' returning fulfillment_id`,
      [fulfillment, step, JSON.stringify(checkpoint)]
    );
    if (!changed.rows[0]) throw new Error('FULFILLMENT_SAGA_STATE_CONFLICT');
  }

  async fail(database: SqlExecutor, fulfillment: string, step: string, error: unknown): Promise<'retry' | 'needsaction'> {
    const code = error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160);
    const current = await database.query<{ attempts: number }>(`select attempts from fulfillment.sagastep where fulfillment_id=$1 and step=$2 and state='running' for update`, [fulfillment, step]);
    const decision = this.failures.classify(error, current.rows[0]?.attempts ?? 0);
    const changed = await database.query<{ state: 'retry' | 'needsaction' }>(
      `update fulfillment.sagastep set state=$4,error_code=$3,
      next_attempt_at=case when $4='needsaction' then null else clock_timestamp()+make_interval(secs=>least(300,power(2,attempts)::integer)) end,
      updated_at=clock_timestamp(),version=version+1 where fulfillment_id=$1 and step=$2 and state='running' returning state`,
      [fulfillment, step, code, decision]
    );
    const state = changed.rows[0]?.state;
    if (!state) throw new Error('FULFILLMENT_SAGA_STATE_CONFLICT');
    if (state === 'needsaction') {
      await database.query(
        `update fulfillment.fulfillmentorder set state='needsaction',updated_at=clock_timestamp(),version=version+1
        where id=$1 and state not in('completed','cancelled','needsaction')`,
        [fulfillment]
      );
    }
    return state;
  }

  async takeover(database: SqlExecutor, fulfillment: string, step: string, error: string): Promise<void> {
    await database.query(
      `insert into fulfillment.sagastep(fulfillment_id,step,idempotency_key,state,attempts,error_code,checkpoint,next_attempt_at,started_at,completed_at,updated_at,version)
      values($1,$2,$3,'needsaction',1,$4,'{}',null,clock_timestamp(),null,clock_timestamp(),0)
      on conflict(fulfillment_id,step) do update set state='needsaction',error_code=excluded.error_code,next_attempt_at=null,
        updated_at=clock_timestamp(),version=fulfillment.sagastep.version+1`,
      [fulfillment, step, `takeover:${fulfillment}:${step}`, error.slice(0, 160)]
    );
    await database.query(
      `update fulfillment.fulfillmentorder set state='needsaction',updated_at=clock_timestamp(),version=version+1
      where id=$1 and state not in('completed','cancelled')`,
      [fulfillment]
    );
  }

  async compensate(database: SqlExecutor, fulfillment: string, step: string, reason: string): Promise<void> {
    const changed = await database.query(
      `update fulfillment.sagastep set state='compensated',error_code=$3,next_attempt_at=null,completed_at=clock_timestamp(),
      updated_at=clock_timestamp(),version=version+1 where fulfillment_id=$1 and step=$2 and state in('succeeded','failed','needsaction') returning fulfillment_id`,
      [fulfillment, step, reason.slice(0, 160)]
    );
    if (!changed.rows[0]) throw new Error('FULFILLMENT_SAGA_COMPENSATION_CONFLICT');
  }
}
