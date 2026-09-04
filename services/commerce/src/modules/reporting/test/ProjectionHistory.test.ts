import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import type { SqlExecutor } from '../../../adapter/database/PgTransactionAccess';
import { result } from '../../../test/TransactionFixture';
import { projectedMetric } from '../domain/model/Projection';
import { PgReportingRepository } from '../infrastructure/persistence/PgReportingRepository';

describe('reporting projection history', () => {
  it('deduplicates an inbox event and keeps a frozen snapshot stable after a late event', async () => {
    const database = new PGlite();
    try {
      await database.exec(schema);
      const repository = new PgReportingRepository({
        transaction: {} as never,
        query: async (sql: string, values?: readonly unknown[]) => {
          const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
          return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
        },
      } as unknown as SqlExecutor);
      const period = { from: '2026-09-04T16:00:00.000Z', to: '2026-09-05T16:00:00.000Z', timezone: 'Asia/Shanghai' } as const;
      const first = projectedMetric('sales.amount', 'mall:one', period, { mall: 'mall:one' }, 100, 'minor', 'CNY', '2026-09-05T10:00:00.000Z');

      await repository.addMetrics([first], 'event:first');
      await repository.addMetrics([first], 'event:first');
      await database.exec("insert into reporting.watermark values('commerce','mall:one','event:first','2026-09-05T10:00:00Z',1)");
      const late = projectedMetric('sales.amount', 'mall:one', period, { mall: 'mall:one' }, 50, 'minor', 'CNY', '2026-09-05T09:00:00.000Z');
      await repository.addMetrics([late], 'event:late');

      const current = await database.query<{ value_numeric: number }>('select value_numeric::integer from reporting.fact');
      const frozen = await database.query<{ value_numeric: number }>(
        `select value_numeric::integer from reporting.factrevision where data_version<=1
        order by projection_version desc limit 1`
      );
      const revisions = await database.query<{ event_id: string; data_version: number }>('select event_id,data_version from reporting.factrevision order by projection_version');
      expect(current.rows[0]?.value_numeric).toBe(150);
      expect(frozen.rows[0]?.value_numeric).toBe(100);
      expect(revisions.rows).toEqual([{ event_id: 'event:first', data_version: 1 }, { event_id: 'event:late', data_version: 2 }]);

      await database.exec("update reporting.period set state='closed'");
      await expect(repository.addMetrics([late], 'event:closed')).rejects.toThrow('REPORT_PERIOD_CLOSED');
      const unchanged = await database.query<{ value_numeric: number }>('select value_numeric::integer from reporting.fact');
      expect(unchanged.rows[0]?.value_numeric).toBe(150);
    } finally {
      await database.close();
    }
  });
});

const schema = `
create schema reporting;
create table reporting.metric(id text,version integer,unit text,dimensions jsonb,primary key(id,version));
insert into reporting.metric values('sales.amount',1,'minor','["mall"]');
create table reporting.watermark(projection text,scope_id text,event_id text,occurred_at timestamptz,version bigint,primary key(projection,scope_id));
create table reporting.period(scope_id text,period_start timestamptz,period_end timestamptz,timezone text,state text,last_event_id text,last_event_at timestamptz,version bigint,primary key(scope_id,period_start,timezone));
create table reporting.fact(metric_id text,metric_version integer,scope_id text,dimensions jsonb,period_start timestamptz,period_end timestamptz,timezone text,value_numeric numeric,currency char(3),watermark timestamptz,projection_version bigint,primary key(metric_id,metric_version,scope_id,period_start,dimensions));
create table reporting.factrevision(metric_id text,metric_version integer,scope_id text,dimensions jsonb,period_start timestamptz,period_end timestamptz,timezone text,value_numeric numeric,currency char(3),watermark timestamptz,data_version bigint,projection_version bigint,event_id text,recorded_at timestamptz,primary key(metric_id,metric_version,scope_id,period_start,dimensions,projection_version),unique(event_id,metric_id,metric_version,scope_id,period_start,dimensions));
`;
