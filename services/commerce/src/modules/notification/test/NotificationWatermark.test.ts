import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { PgTransactionAccess } from '../../../platform/database/PgTransactionAccess';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgNotificationRepository } from '../infrastructure/persistence/PgNotificationRepository';

describe('notification read watermark concurrency', () => {
  it('keeps one monotonic member/device row under concurrent and repeated acknowledgements', async () => {
    const database = new PGlite();
    try {
      await database.exec(schema);
      const query = async (sql: string, values?: readonly unknown[]) => {
        const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
        return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
      };
      const repository = new PgNotificationRepository(new PgTransactionAccess(), {} as never, {} as never, {} as never);
      const ack = (id: string) => withWriteTransaction(query, (context) => repository.acknowledge(context, 'membership:one', 'a'.repeat(64), id));

      await Promise.all([ack('dispatch:old'), ack('dispatch:new'), ack('dispatch:old'), ack('dispatch:new')]);
      const rows = await database.query<{ notification_id: string; version: number; read_at: string }>('select notification_id,version,read_at from notification.readwatermark');
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.notification_id).toBe('dispatch:new');
      const before = rows.rows[0]?.read_at;
      await ack('dispatch:new');
      const repeated = await database.query<{ notification_id: string; version: number; read_at: string }>('select notification_id,version,read_at from notification.readwatermark');
      expect(repeated.rows[0]).toMatchObject({ notification_id: 'dispatch:new', version: rows.rows[0]?.version, read_at: before });
    } finally {
      await database.close();
    }
  });
});

const schema = `
create schema notification;
create table notification.visible(member_id text,id text primary key,kind text,event_type text,channel text,subject text,body text,state text,created_at timestamptz);
insert into notification.visible values
  ('member:one','dispatch:old','dispatch','order.paid','inapp','旧消息','正文','sent','2026-09-05T00:00:00Z'),
  ('member:one','dispatch:new','dispatch','order.paid','inapp','新消息','正文','sent','2026-09-05T01:00:00Z');
create function notification.visible_notifications(text,boolean)
returns table(member_id text,id text,kind text,event_type text,channel text,subject text,body text,state text,created_at timestamptz)
language sql stable as $$ select * from notification.visible $$;
create table notification.readwatermark(
  member_id text not null,device_token char(64) not null,notification_id text not null,notification_time timestamptz not null,
  read_at timestamptz not null,version bigint not null,primary key(member_id,device_token));
`;
