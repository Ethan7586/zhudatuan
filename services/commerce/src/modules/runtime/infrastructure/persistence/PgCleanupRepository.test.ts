import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { result, withReadTransaction, withWriteTransaction } from '../../../../test/TransactionFixture';
import { createCleanupRepositories } from './PgCleanupRepository';

describe('runtime retention repositories', () => {
  let database: PGlite;
  let query: (sql: string, values?: readonly unknown[]) => Promise<ReturnType<typeof result>>;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(schema);
    query = async (sql, values) => {
      const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
      return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
    };
  });

  afterEach(async () => database.close());

  it('recovers expired workers and physically deletes only expired terminal jobs', async () => {
    await database.exec(`
      insert into runtime.jobs(id,state,cancel_requested_at,lease_owner,lease_deadline,version,updated_by,updated_at,attempts,retention_until) values
        ('job:cleanup','running',null,'worker:cleanup',clock_timestamp()+interval '1 hour',1,'migration',clock_timestamp(),0,clock_timestamp()+interval '2 days'),
        ('job:recover','running',null,'worker:one',clock_timestamp()-interval '1 minute',2,'worker:one',clock_timestamp(),2,clock_timestamp()+interval '2 days'),
        ('job:cancel','running',clock_timestamp(),'worker:two',clock_timestamp()-interval '1 minute',3,'worker:two',clock_timestamp(),3,clock_timestamp()+interval '2 days'),
        ('job:terminal','succeeded',null,null,null,1,'worker:one',clock_timestamp(),1,clock_timestamp()-interval '2 days'),
        ('job:future','failed',null,null,null,1,'worker:one',clock_timestamp(),0,clock_timestamp()+interval '2 days'),
        ('job:active','queued',null,null,null,1,'worker:one',clock_timestamp(),0,clock_timestamp()-interval '2 days'),
        ('job:linked','failed',null,null,null,1,'worker:one',clock_timestamp(),0,clock_timestamp()-interval '2 days');
      insert into runtime.job_attempts values
        ('attempt:recover','job:recover',2,'running',null,null,null),
        ('attempt:cancel','job:cancel',3,'running',null,null,null),
        ('attempt:terminal','job:terminal',1,'succeeded',null,clock_timestamp(),null);
      insert into runtime.deadletters values('deadletter:open','open','job:linked',null,null,clock_timestamp()-interval '2 days');
    `);
    const cleanup = createCleanupRepositories();
    await withWriteTransaction(query, (context) => cleanup.jobs.recover(context, 'job:cleanup', 100));
    await withWriteTransaction(query, (context) =>
      cleanup.jobs.record(
        context,
        { id: 'job:cleanup', token: 1 },
        {
          hash: 'a'.repeat(64),
          createdAt: new Date().toISOString(),
          inboxBefore: new Date(0).toISOString(),
          outboxBefore: new Date(0).toISOString(),
          counts: { jobs: 1, imports: 0, exports: 0, idempotency: 0, deadletters: 0, inbox: 0, outbox: 0, objects: 0 },
        }
      )
    );
    expect((await database.query(`select checkpoint->'cleanup'->>'hash' hash from runtime.jobs where id='job:cleanup'`)).rows).toEqual([{ hash: 'a'.repeat(64) }]);
    expect((await database.query(`select id,state,lease_owner from runtime.jobs where id in('job:recover','job:cancel') order by id`)).rows).toEqual([
      { id: 'job:cancel', state: 'cancelled', lease_owner: null },
      { id: 'job:recover', state: 'queued', lease_owner: null },
    ]);
    expect((await database.query(`select id,state,error_code from runtime.job_attempts where id in('attempt:recover','attempt:cancel') order by id`)).rows).toEqual([
      { id: 'attempt:cancel', state: 'cancelled', error_code: null },
      { id: 'attempt:recover', state: 'failed', error_code: 'JOB_LEASE_EXPIRED' },
    ]);
    const planned = await withReadTransaction(query, (context) => cleanup.jobs.plan(context, 100));
    expect(planned).toEqual(['job:terminal']);
    await withWriteTransaction(query, async (context) => {
      const deadletters = await cleanup.control.planDeadletters(context, 100);
      await cleanup.control.purgeDeadletters(context, deadletters);
      expect(await cleanup.jobs.purge(context, planned)).toBe(1);
    });
    expect(await ids(database, 'runtime.jobs')).toEqual(['job:active', 'job:cancel', 'job:cleanup', 'job:future', 'job:linked', 'job:recover']);
    expect(await ids(database, 'runtime.job_attempts')).toEqual(['attempt:cancel', 'attempt:recover']);
  });

  it('expires abandoned uploads and purges import or export metadata only from a planned terminal batch', async () => {
    await database.exec(`
      insert into runtime.imports values
        ('import:abandoned','uploaded','object:abandoned',null,'{}',1,'migration',clock_timestamp(),clock_timestamp()-interval '1 day'),
        ('import:confirmed','ready','object:confirmed',null,'{"confirmedAt":"now"}',1,'migration',clock_timestamp(),clock_timestamp()-interval '1 day'),
        ('import:expired','succeeded','object:source','object:report','{}',1,'worker',clock_timestamp(),clock_timestamp()-interval '1 day'),
        ('import:future','failed','object:future',null,'{}',1,'worker',clock_timestamp(),clock_timestamp()+interval '1 day');
      insert into runtime.import_chunks values('chunk:expired','import:expired'),('chunk:future','import:future');
      insert into runtime.exports values
        ('export:ready','ready','object:export',clock_timestamp()-interval '1 day'),
        ('export:empty','failed',null,clock_timestamp()-interval '2 days'),
        ('export:running','running',null,clock_timestamp()-interval '1 day'),
        ('export:future','failed',null,clock_timestamp()+interval '1 day');
    `);
    const cleanup = createCleanupRepositories();
    await withWriteTransaction(query, (context) => cleanup.imports.expire(context, 100));
    expect((await database.query(`select id,state from runtime.imports where id in('import:abandoned','import:confirmed') order by id`)).rows).toEqual([
      { id: 'import:abandoned', state: 'expired' },
      { id: 'import:confirmed', state: 'ready' },
    ]);
    const imports = await withReadTransaction(query, (context) => cleanup.imports.plan(context, 10));
    const exports = await withReadTransaction(query, (context) => cleanup.exports.plan(context, 10));
    expect(imports).toEqual({ ids: ['import:abandoned', 'import:expired'], objects: ['object:abandoned', 'object:source', 'object:report'] });
    expect(exports).toEqual({ ids: ['export:empty', 'export:ready'], objects: ['object:export'] });
    await withWriteTransaction(query, async (context) => {
      await cleanup.imports.purge(context, imports.ids);
      await cleanup.exports.purge(context, exports.ids);
    });
    expect(await ids(database, 'runtime.imports')).toEqual(['import:confirmed', 'import:future']);
    expect(await ids(database, 'runtime.import_chunks')).toEqual(['chunk:future']);
    expect(await ids(database, 'runtime.exports')).toEqual(['export:future', 'export:running']);
  });

  it('retains in-flight control records and deletes only old settled inbox and outbox rows', async () => {
    await database.exec(`
      insert into runtime.idempotency values
        ('scope:test','actor:test','idem:started','started',clock_timestamp()-interval '1 day'),
        ('scope:test','actor:test','idem:completed','completed',clock_timestamp()-interval '1 day'),
        ('scope:test','actor:test','idem:future','failed',clock_timestamp()+interval '1 day');
      insert into runtime.deadletters values
        ('deadletter:open','open',null,null,null,clock_timestamp()-interval '1 day'),
        ('deadletter:resolved','resolved',null,null,clock_timestamp(),clock_timestamp()-interval '1 day'),
        ('deadletter:future','discarded',null,null,clock_timestamp(),clock_timestamp()+interval '1 day');
      insert into runtime.inbox values
        ('consumer:test','inbox:old',clock_timestamp()-interval '100 days',clock_timestamp()-interval '100 days'),
        ('consumer:test','inbox:pending',clock_timestamp()-interval '100 days',null),
        ('consumer:test','inbox:recent',clock_timestamp(),clock_timestamp());
      insert into runtime.outbox values
        ('outbox:old',clock_timestamp()-interval '100 days',clock_timestamp()-interval '100 days'),
        ('outbox:pending',clock_timestamp()-interval '100 days',null),
        ('outbox:recent',clock_timestamp(),clock_timestamp());
    `);
    const cleanup = createCleanupRepositories();
    await withWriteTransaction(query, async (context) => {
      const cutoff = new Date(Date.now() - 90 * 86_400_000);
      const idempotency = await cleanup.control.planIdempotency(context, 100);
      const deadletters = await cleanup.control.planDeadletters(context, 100);
      const inbox = await cleanup.inbox.plan(context, cutoff, 100);
      const outbox = await cleanup.outbox.plan(context, cutoff, 100);
      expect(await cleanup.control.purgeIdempotency(context, idempotency)).toBe(1);
      expect(await cleanup.control.purgeDeadletters(context, deadletters)).toBe(1);
      expect(await cleanup.inbox.purge(context, inbox, cutoff)).toBe(1);
      expect(await cleanup.outbox.purge(context, outbox, cutoff)).toBe(1);
    });
    expect(await ids(database, 'runtime.idempotency', 'key')).toEqual(['idem:future', 'idem:started']);
    expect(await ids(database, 'runtime.deadletters')).toEqual(['deadletter:future', 'deadletter:open']);
    expect(await ids(database, 'runtime.inbox', 'event_id')).toEqual(['inbox:pending', 'inbox:recent']);
    expect(await ids(database, 'runtime.outbox')).toEqual(['outbox:pending', 'outbox:recent']);
  });
});

async function ids(database: PGlite, table: string, column = 'id'): Promise<unknown[]> {
  return (await database.query<{ id: string }>(`select ${column} id from ${table} order by ${column}`)).rows.map(({ id }) => id);
}

const schema = `
  create schema runtime;
  create table runtime.jobs(
    id text primary key,state text not null,cancel_requested_at timestamptz,lease_owner text,lease_deadline timestamptz,
    version bigint not null,updated_by text not null,updated_at timestamptz not null,attempts integer not null default 0,
    retention_until timestamptz not null,fencing_token bigint not null default 1,checkpoint jsonb not null default '{}'
  );
  create table runtime.job_attempts(
    id text primary key,job_id text not null references runtime.jobs(id),attempt integer not null,state text not null,
    error_code text,finished_at timestamptz,error_detail jsonb
  );
  create table runtime.imports(
    id text primary key,state text not null,object_key text not null,error_report_key text,checkpoint jsonb not null,
    version bigint not null,updated_by text not null,updated_at timestamptz not null,retention_until timestamptz not null
  );
  create table runtime.import_chunks(id text primary key,import_id text not null references runtime.imports(id));
  create table runtime.exports(id text primary key,state text not null,object_key text,retention_until timestamptz not null);
  create table runtime.deadletters(
    id text primary key,state text not null,retry_job_id text references runtime.jobs(id),reviewed_by text,reviewed_at timestamptz,retention_until timestamptz not null
  );
  create table runtime.idempotency(
    scope text not null,actor_id text not null,key text not null,state text not null,expires_at timestamptz not null,
    primary key(scope,actor_id,key)
  );
  create table runtime.inbox(
    consumer text not null,event_id text not null,received_at timestamptz not null,processed_at timestamptz,
    primary key(consumer,event_id)
  );
  create table runtime.outbox(id text primary key,occurred_at timestamptz not null,published_at timestamptz);
`;
