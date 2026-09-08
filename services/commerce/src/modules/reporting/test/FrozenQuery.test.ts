import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { PgTransactionAccess } from '../../../platform/database/PgTransactionAccess';
import { result, withReadTransaction } from '../../../test/TransactionFixture';
import { PgReportRepository } from '../infrastructure/persistence/PgReportRepository';

describe('frozen reporting query', () => {
  it('anchors a realtime day to the snapshot IANA timezone across the spring DST boundary', async () => {
    const database = new PGlite();
    try {
      await database.exec(schema);
      await database.exec(`
        insert into reporting.factrevision values
          ('sales.amount',1,'mall:one','{"mall":"mall:one"}','2026-03-08T05:00:00Z','2026-03-09T04:00:00Z','America/New_York',100,'USD','2026-03-08T15:00:00Z',1,1,'event:current','2026-03-08T15:00:01Z'),
          ('sales.amount',1,'mall:one','{"mall":"mall:one"}','2026-03-07T05:00:00Z','2026-03-08T05:00:00Z','America/New_York',50,'USD','2026-03-07T15:00:00Z',1,1,'event:previous','2026-03-07T15:00:01Z');
      `);
      const rows = await withReadTransaction(
        async (sql, values) => {
          const selected = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
          return result(selected.rows);
        },
        (context) =>
          new PgReportRepository(new PgTransactionAccess()).metrics(context, {
            scope: 'mall:one',
            dimension: 'sales',
            period: 'realtime',
            application: null,
            watermarkAt: '2026-03-08T15:00:00.000Z',
            watermarkVersion: 1,
            snapshotAt: '2026-03-08T16:00:00.000Z',
            cursorTime: null,
            cursorId: null,
            fetch: 50,
          })
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        value: 100,
        currency: 'USD',
        period: {
          from: '2026-03-08T05:00:00.000Z',
          to: '2026-03-09T04:00:00.000Z',
          timezone: 'America/New_York',
        },
      });
    } finally {
      await database.close();
    }
  });
});

const schema = `
create schema reporting;
create table reporting.metric(
  id text,version integer,name text,formula text,dimensions jsonb,granularity text,owner text,unit text,
  primary key(id,version)
);
insert into reporting.metric values('sales.amount',1,'成交金额','支付金额合计','["mall"]','day','reporting','minor');
create table reporting.factrevision(
  metric_id text,metric_version integer,scope_id text,dimensions jsonb,period_start timestamptz,period_end timestamptz,
  timezone text,value_numeric numeric,currency char(3),watermark timestamptz,data_version bigint,projection_version bigint,
  event_id text,recorded_at timestamptz
);
`;
