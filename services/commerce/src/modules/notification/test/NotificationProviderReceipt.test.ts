import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { PgTransactionAccess } from '../../../adapter/database/PgTransactionAccess';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import type { DispatchRecord } from '../application/port/DeliveryRepository';
import { PgDeliveryRepository } from '../infrastructure/persistence/PgDeliveryRepository';

describe('notification provider receipt idempotency', () => {
  it('accepts the same receipt for one dispatch once and rejects cross-dispatch reuse', async () => {
    const database = new PGlite();
    try {
      await database.exec(schema);
      const query = async (sql: string, values?: readonly unknown[]) => {
        const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
        return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
      };
      const repository = new PgDeliveryRepository({} as never, {} as never, new PgTransactionAccess());
      const complete = (dispatch: DispatchRecord) => withWriteTransaction(query,
        (context) => repository.complete(context, dispatch, { provider: 'email.primary', externalId: 'provider:receipt:one' }, 1));

      await complete(dispatch('dispatch:one'));
      await complete(dispatch('dispatch:one'));
      await expect(complete(dispatch('dispatch:two'))).rejects.toThrow('NOTIFICATION_DELIVERY_STATE_LOST');

      const counts = await database.query<{ receipts: number; attempts: number; events: number }>(
        `select (select count(*)::integer from notification.providerreceipt) receipts,
          (select count(*)::integer from notification.attempt) attempts,
          (select count(*)::integer from runtime.outbox) events`
      );
      expect(counts.rows[0]).toEqual({ receipts: 1, attempts: 1, events: 1 });
      const states = await database.query<{ id: string; state: string }>('select id,state from notification.dispatch order by id');
      expect(states.rows).toEqual([{ id: 'dispatch:one', state: 'sent' }, { id: 'dispatch:two', state: 'sending' }]);
    } finally {
      await database.close();
    }
  });
});

function dispatch(id: string): DispatchRecord {
  return {
    id, scope_id: 'mall:one', member_id: 'member:one', template_id: 'template:one', channel: 'email',
    event_type: 'order.paid', template_version: 1, provider_template: null, variable_schema: {}, subject: null, body: '订单已支付',
    payload: {}, recipient_ciphertext: null, recipient_ref: 'member:one', purpose: 'transactional', mandatory: false,
    attempt_sequence: 1, max_attempts: 5, preference_enabled: true, authorization_state: 'unknown', consent_source: 'member',
    quiet_start: null, quiet_end: null, quiet_timezone: null, preference_version: 0,
  };
}

const schema = `
create schema notification;
create schema runtime;
create table notification.dispatch(
  id text primary key,scope_id text not null,member_id text,channel text not null,state text not null,
  last_error_class text,last_error_code text);
insert into notification.dispatch values
  ('dispatch:one','mall:one','member:one','email','sending',null,null),
  ('dispatch:two','mall:one','member:one','email','sending',null,null);
create table notification.providerreceipt(
  id text primary key,dispatch_id text not null,scope_id text not null,provider text not null,external_id text not null,
  received_at timestamptz not null,unique(provider,external_id));
create table notification.attempt(
  id text primary key,dispatch_id text not null,scope_id text not null,member_id text,provider text not null,external_id text,
  state text not null,sequence integer not null,route_index integer not null,attempted_at timestamptz not null);
create table runtime.outbox(
  id text primary key,event_type text not null,event_version integer not null,aggregate_type text not null,
  aggregate_id text not null,scope_id text not null,payload jsonb not null,trace_id text not null,
  occurred_at timestamptz not null,available_at timestamptz not null);
`;
