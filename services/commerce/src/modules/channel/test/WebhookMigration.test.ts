import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../../../../database/migrations/20260904031000_verify_channel_webhook.sql', import.meta.url), 'utf8');
const guards = migration.slice(migration.indexOf('create function channel.guard_webhook_receipt'), migration.indexOf('alter table channel.provideroperation'));
const accept = migration.slice(migration.indexOf('create function channel.accept_webhook'), migration.indexOf('revoke all on function channel.accept_webhook'));

describe('channel webhook database hard cut', () => {
  it('keeps pre-verification evidence in Receipt and makes terminal transitions immutable', async () => {
    const database = await fixture();
    try {
      await expect(database.exec(`update channel.webhookreceipt set raw_hash='${'b'.repeat(64)}',version=version+1 where id='webhookreceipt:one'`))
        .rejects.toThrow('CHANNEL_WEBHOOK_RECEIPT_EVIDENCE_IMMUTABLE');
      await database.exec(`update channel.webhookreceipt set state='verified',verified_at=now(),version=version+1 where id='webhookreceipt:one'`);
      await expect(database.exec(`update channel.webhookreceipt set state='processing',verified_at=null,version=version+1 where id='webhookreceipt:one'`))
        .rejects.toThrow('CHANNEL_WEBHOOK_RECEIPT_TRANSITION_INVALID');
      await database.exec(`update channel.webhookinbox set state='applied',processed_at=now(),version=version+1 where id='webhook:one'`);
      await expect(database.exec(`update channel.webhookinbox set state='processing',processed_at=null,version=version+1 where id='webhook:one'`))
        .rejects.toThrow('CHANNEL_WEBHOOK_TRANSITION_INVALID');
    } finally { await database.close(); }
  });

  it('accepts encrypted receipts without inserting an unverified Inbox or bypassing the runtime task port', () => {
    expect(accept).toContain('insert into channel.webhookreceipt');
    expect(accept).not.toContain('channel.webhookinbox');
    expect(accept).not.toContain('runtime.jobs');
  });
});

async function fixture(): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`create schema channel;
    create table channel.webhookreceipt(id text primary key,connection_id text,provider text,scope_id text,external_id text,
      raw_ciphertext text,raw_key_version text,raw_hash text,signature_hash text,state text,attempts integer,failure_class text,
      error_code text,failure_retryable boolean,received_at timestamptz,verified_at timestamptz,failed_at timestamptz,trace_id text,
      retention_until timestamptz,version bigint);
    create table channel.webhookinbox(id text primary key,receipt_id text,connection_id text,provider text,scope_id text,
      external_id text,event_type text,external_reference text,normalized jsonb,raw_hash text,signature_hash text,state text,
      error_code text,received_at timestamptz,processed_at timestamptz,trace_id text,attempts integer,watermark timestamptz,
      failure_class text,failure_retryable boolean,version bigint);
    ${guards}
    insert into channel.webhookreceipt values('webhookreceipt:one','connection:one','supplier','mall:one','event:one',
      'ciphertext','kms:v1','${'a'.repeat(64)}','${'a'.repeat(64)}','processing',1,null,null,null,now(),null,null,
      'trace:one',now()+interval '90 days',1);
    insert into channel.webhookinbox values('webhook:one','webhookreceipt:one','connection:one','supplier','mall:one',
      'event:one','shipment.changed','external:one','{}','${'a'.repeat(64)}','${'a'.repeat(64)}','processing',null,now(),null,
      'trace:one',1,now(),null,null,0);`);
  return database;
}
