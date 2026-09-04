import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../../../../database/migrations/20260904030900_guard_channel_sync.sql', import.meta.url), 'utf8');
const guard = migration.slice(migration.indexOf('create or replace function channel.guard_syncrun_checkpoint'), migration.indexOf('select runtime.record_migration_evidence'));

describe('channel sync database guard', () => {
  it('allows only pull to apply to committed cursor progression and a resumable next pull', async () => {
    const database = await fixture();
    try {
      await database.exec(`update channel.syncrun set phase='apply',version=version+1 where id='sync:one'`);
      await expect(database.exec(`update channel.syncrun set cursor_value='cursor:unsafe',version=version+1 where id='sync:one'`)).rejects.toThrow('CHANNEL_SYNC_CURSOR_UNCOMMITTED');
      await database.exec(`update channel.syncrun set phase='commit',cursor_value='cursor:one',watermark=now(),pulled_count=1,accepted_count=1,version=version+1 where id='sync:one'`);
      await database.exec(`update channel.syncrun set phase='pull',version=version+1 where id='sync:one'`);
      expect((await database.query(`select state,phase,cursor_value,pulled_count,accepted_count,version from channel.syncrun where id='sync:one'`)).rows).toEqual([
        { state: 'running', phase: 'pull', cursor_value: 'cursor:one', pulled_count: 1, accepted_count: 1, version: 4 },
      ]);
    } finally {
      await database.close();
    }
  });

  it('rejects unsafe error details and permits cancellation without cursor movement', async () => {
    const database = await fixture();
    try {
      await database.exec(`update channel.syncrun set phase='apply',version=version+1 where id='sync:one'`);
      await expect(database.exec(`update channel.syncrun set phase='commit',error_summary='[{"message":"raw provider response"}]',version=version+1 where id='sync:one'`)).rejects.toThrow('CHANNEL_SYNC_ERROR_SUMMARY_UNSAFE');
      await database.exec(`update channel.syncrun set state='cancelled',completed_at=now(),version=version+1 where id='sync:one'`);
      expect((await database.query(`select state,phase,cursor_value from channel.syncrun where id='sync:one'`)).rows).toEqual([{ state: 'cancelled', phase: 'apply', cursor_value: null }]);
    } finally {
      await database.close();
    }
  });
});

async function fixture(): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`create schema channel;
    create table channel.syncrun(
      id text primary key,connection_id text not null,kind text not null,input_hash text not null,input jsonb not null,
      state text not null,phase text not null,cursor_value text,watermark timestamptz,pulled_count bigint not null,
      accepted_count bigint not null,rejected_count bigint not null,error_summary jsonb not null,completed_at timestamptz,
      failure_class text,failure_code text,failure_retryable boolean,version bigint not null);
    insert into channel.syncrun values(
      'sync:one','connection:one','catalog','${'a'.repeat(64)}','{}','running','pull',null,null,0,0,0,'[]',null,null,null,null,1);
    ${guard}
    create trigger channel_syncrun_checkpoint before update on channel.syncrun for each row execute function channel.guard_syncrun_checkpoint();`);
  return database;
}
