import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canonicalFinancialActionRequest } from '@shop/contract';

const migrations = fileURLToPath(new URL('../../../../database/supabase/migrations', import.meta.url));
const actor = 'member-fresh-replay-ethan';
const membership = 'membership-platform-owner-ethan-v1';
const scope = 'mall-demo';
const currentSession = 'session:proof:current';
const otherSession = 'session:proof:other';
const borrowerSession = 'session:proof:borrower';

describe('finance action proof PostgreSQL boundary', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await replayThroughFinanceSecurity(database);
    await database.exec(`
      insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
        ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values('${currentSession}','${actor}','${membership}',repeat('1',64),
          (select credential_version from identity.principal where id='${actor}'),
          (select access_version from access.membership where id='${membership}'),'console',repeat('2',64),'test','current',3,
          clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
        ('${otherSession}','${actor}','${membership}',repeat('3',64),
          (select credential_version from identity.principal where id='${actor}'),
          (select access_version from access.membership where id='${membership}'),'console',repeat('4',64),'test','other',3,
          clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
        ('${borrowerSession}','${actor}','${membership}',repeat('7',64),
          (select credential_version from identity.principal where id='${actor}'),
          (select access_version from access.membership where id='${membership}'),'console',repeat('8',64),'test','borrower',3,
          clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
      insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:proof:current','${actor}','${currentSession}','otp',3,repeat('5',64),clock_timestamp(),clock_timestamp()+interval '15 minutes'),
        ('assurance:proof:other','${actor}','${otherSession}','otp',3,repeat('6',64),clock_timestamp(),clock_timestamp()+interval '15 minutes');
      insert into access.rolepermission(role_id,permission_id,effect)
      select 'role-platform-owner-v2',permission.id,'allow' from access.permission permission
      where permission.code='finance.statement.export'
      on conflict do nothing;
    `);
  }, 20_000);

  afterAll(async () => database.close());

  it('rejects another session assurance and atomically binds/consumes the canonical request hash', async () => {
    const requestHash = createHash('sha256')
      .update(canonicalFinancialActionRequest({ operation: 'finance.statements.export', path: {}, query: {}, body: null }))
      .digest('hex');

    await expect(issue(database, '7'.repeat(64), 'assurance:proof:other', 'export:wrong-session', requestHash)).rejects.toThrow('STEPUP_REQUIRED');
    await issue(database, '8'.repeat(64), 'assurance:proof:current', 'export:one', requestHash);

    await expect(consume(database, '8'.repeat(64), 'export:one', '9'.repeat(64))).resolves.toBe(false);
    await expect(consume(database, '8'.repeat(64), 'export:one', requestHash)).resolves.toBe(true);
    await expect(consume(database, '8'.repeat(64), 'export:one', requestHash)).resolves.toBe(false);
  });

  it('rolls consumption back with the surrounding command transaction', async () => {
    const requestHash = 'a'.repeat(64);
    await issue(database, 'b'.repeat(64), 'assurance:proof:current', 'export:rollback', requestHash);

    await database.exec('begin');
    await expect(consume(database, 'b'.repeat(64), 'export:rollback', requestHash)).resolves.toBe(true);
    await database.exec('rollback');
    await expect(consume(database, 'b'.repeat(64), 'export:rollback', requestHash)).resolves.toBe(true);
  });

  it('does not let a Level 3 session borrow another session assurance', async () => {
    const current = await resolvedSession(database, '1'.repeat(64));
    const borrower = await resolvedSession(database, '7'.repeat(64));

    expect(current).toEqual({ session_id: currentSession, assurance_level: 3, assurance_verified_at: expect.any(Date) });
    expect(borrower).toEqual({ session_id: borrowerSession, assurance_level: 2, assurance_verified_at: null });
  });

  it('downgrades an actually expired Level 3 assurance and permits a fresh session-bound step-up', async () => {
    await database.exec(`insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:proof:borrower:expiring','${actor}','${borrowerSession}','otp',3,repeat('c',64),
        clock_timestamp(),clock_timestamp()+interval '1 second')`);
    await expect(resolvedSession(database, '7'.repeat(64))).resolves.toEqual({
      session_id: borrowerSession,
      assurance_level: 3,
      assurance_verified_at: expect.any(Date),
    });

    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await expect(resolvedSession(database, '7'.repeat(64))).resolves.toEqual({
      session_id: borrowerSession,
      assurance_level: 2,
      assurance_verified_at: null,
    });

    await database.exec(`insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:proof:borrower:fresh','${actor}','${borrowerSession}','otp',3,repeat('d',64),
        clock_timestamp(),clock_timestamp()+interval '15 minutes')`);
    const requestHash = digest('borrower:fresh:request');
    await issue(database, digest('borrower:fresh:proof'), 'assurance:proof:borrower:fresh', 'export:borrower:fresh', requestHash, borrowerSession);
    await expect(consume(database, digest('borrower:fresh:proof'), 'export:borrower:fresh', requestHash, borrowerSession)).resolves.toBe(true);
  });

  it('revalidates principal, membership, capability and permission at issuance and consumption', async () => {
    const requestHash = digest('revocation:request');

    await issue(database, digest('proof:credential'), 'assurance:proof:current', 'export:credential', requestHash);
    await database.exec(`update identity.principal set credential_version=credential_version+1 where id='${actor}'`);
    await expect(consume(database, digest('proof:credential'), 'export:credential', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:credential:issue'), 'assurance:proof:current', 'export:credential:issue', requestHash)).rejects.toThrow('STEPUP_REQUIRED');
    await database.exec(`update identity.principal set credential_version=(select credential_version from identity.session where id='${currentSession}') where id='${actor}'`);

    await issue(database, digest('proof:principal-status'), 'assurance:proof:current', 'export:principal-status', requestHash);
    await database.exec(`update identity.principal set status='locked' where id='${actor}'`);
    await expect(consume(database, digest('proof:principal-status'), 'export:principal-status', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:principal-status:issue'), 'assurance:proof:current', 'export:principal-status:issue', requestHash)).rejects.toThrow('STEPUP_REQUIRED');
    await database.exec(`update identity.principal set status='active' where id='${actor}'`);

    await issue(database, digest('proof:access-version'), 'assurance:proof:current', 'export:access-version', requestHash);
    await database.exec(`update access.membership set access_version=access_version+1 where id='${membership}'`);
    await expect(consume(database, digest('proof:access-version'), 'export:access-version', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:access-version:issue'), 'assurance:proof:current', 'export:access-version:issue', requestHash)).rejects.toThrow('STEPUP_REQUIRED');
    await database.exec(`update access.membership set access_version=(select access_version from identity.session where id='${currentSession}') where id='${membership}'`);

    await issue(database, digest('proof:membership-status'), 'assurance:proof:current', 'export:membership-status', requestHash);
    await database.exec(`update access.membership set status='suspended' where id='${membership}'`);
    await expect(consume(database, digest('proof:membership-status'), 'export:membership-status', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:membership-status:issue'), 'assurance:proof:current', 'export:membership-status:issue', requestHash)).rejects.toThrow('STEPUP_REQUIRED');
    await database.exec(`update access.membership set status='active' where id='${membership}'`);

    await issue(database, digest('proof:capability'), 'assurance:proof:current', 'export:capability', requestHash);
    await database.exec(`update capability.entitlement set state='disabled' where capability_id='finance.statements.export'`);
    await expect(consume(database, digest('proof:capability'), 'export:capability', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:capability:issue'), 'assurance:proof:current', 'export:capability:issue', requestHash)).rejects.toThrow('PERMISSION_DENIED');
    await database.exec(`update capability.entitlement set state='enabled' where capability_id='finance.statements.export'`);

    await issue(database, digest('proof:capability-status'), 'assurance:proof:current', 'export:capability-status', requestHash);
    await database.exec(`update capability.capability set status='retired' where id='finance.statements.export'`);
    await expect(consume(database, digest('proof:capability-status'), 'export:capability-status', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:capability-status:issue'), 'assurance:proof:current', 'export:capability-status:issue', requestHash)).rejects.toThrow('PERMISSION_DENIED');
    await database.exec(`update capability.capability set status='active' where id='finance.statements.export'`);

    await issue(database, digest('proof:permission-status'), 'assurance:proof:current', 'export:permission-status', requestHash);
    await database.exec(`update access.permission set status='retired' where code='finance.statement.export'`);
    await expect(consume(database, digest('proof:permission-status'), 'export:permission-status', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:permission-status:issue'), 'assurance:proof:current', 'export:permission-status:issue', requestHash)).rejects.toThrow('PERMISSION_DENIED');
    await database.exec(`update access.permission set status='active' where code='finance.statement.export'`);

    await issue(database, digest('proof:permission'), 'assurance:proof:current', 'export:permission', requestHash);
    await database.exec(`delete from access.rolepermission mapping using access.permission permission
      where mapping.role_id='role-platform-owner-v2' and mapping.permission_id=permission.id
        and permission.code='finance.statement.export' and mapping.effect='allow'`);
    await expect(consume(database, digest('proof:permission'), 'export:permission', requestHash)).resolves.toBe(false);
    await expect(issue(database, digest('proof:permission:issue'), 'assurance:proof:current', 'export:permission:issue', requestHash)).rejects.toThrow('PERMISSION_DENIED');
    await database.exec(`insert into access.rolepermission(role_id,permission_id,effect)
      select 'role-platform-owner-v2',id,'allow' from access.permission where code='finance.statement.export'`);
  });

  it('authorizes invoice facts by immutable request profile ownership across scopes', async () => {
    await database.exec(`insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
      taxid_key_version,status,version) values('profile:rls','scope:invoice:original','title','v1','tax',repeat('e',64),'v1','active',0);
      insert into invoice.request(id,profile_id,amount_minor,currency,state,created_at,version,requested_by)
      values('request:rls','profile:rls',100,'CNY','submitted',clock_timestamp(),0,'${actor}');
      insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
        taxid_key_version,profile_version) values('request:rls','scope:invoice:original','title','v1','tax',repeat('e',64),'v1',0);
      insert into invoice.document(id,request_id,provider,external_id,object_ref,sha256,issued_at)
      values('document:rls','request:rls','fixture','external:rls','object:rls',repeat('f',64),clock_timestamp());
      insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor)
      values('request:rls',1,'line',100,10);
      insert into invoice.statusevent(request_id,sequence,state,occurred_at)
      values('request:rls',1,'submitted',clock_timestamp());
      update invoice.profile set owner_id='scope:invoice:moved' where id='profile:rls'`);

    await expect(database.exec(`update invoice.requestprofile set owner_id='scope:invoice:moved' where request_id='request:rls'`)).rejects.toThrow('FINANCE_LEDGER_APPEND_ONLY');
    await expect(invoiceVisibility(database, 'scope:invoice:original')).resolves.toEqual({ request: 1, document: 1, line: 1, status: 1 });
    await expect(invoiceVisibility(database, 'scope:invoice:moved')).resolves.toEqual({ request: 0, document: 0, line: 0, status: 0 });
  });

  it('rejects fresh or pending financial fact deletion while allowing completed facts after 90 days', async () => {
    await database.exec(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,
      trace_id,occurred_at,available_at,published_at) values
      ('outbox:fresh','finance.settlement.approved',1,'settlement','fresh','${scope}','{}','trace:fresh',
        clock_timestamp(),clock_timestamp(),clock_timestamp()),
      ('outbox:pending','invoice.issued',1,'invoice','pending','${scope}','{}','trace:pending',
        clock_timestamp()-interval '91 days',clock_timestamp()-interval '91 days',null),
      ('outbox:aged','payment.succeeded',1,'payment','aged','${scope}','{}','trace:aged',
        clock_timestamp()-interval '91 days',clock_timestamp()-interval '91 days',clock_timestamp()-interval '91 days');
      insert into runtime.inbox(consumer,event_id,event_type,event_version,trace_id,payload,received_at,processed_at) values
      ('proof','inbox:fresh','finance.reconciliation.difference',1,'trace:fresh','{}',clock_timestamp(),clock_timestamp()),
      ('proof','inbox:pending','invoice.red.issued',1,'trace:pending','{}',clock_timestamp()-interval '91 days',null),
      ('proof','inbox:aged','order.placed',1,'trace:aged','{}',clock_timestamp()-interval '91 days',clock_timestamp()-interval '91 days')`);

    await expect(database.exec(`delete from runtime.outbox where id='outbox:fresh'`)).rejects.toThrow('FINANCIAL_EVENT_FACT_RETENTION_REQUIRED');
    await expect(database.exec(`delete from runtime.outbox where id='outbox:pending'`)).rejects.toThrow('FINANCIAL_EVENT_FACT_RETENTION_REQUIRED');
    await expect(database.exec(`delete from runtime.inbox where consumer='proof' and event_id='inbox:fresh'`)).rejects.toThrow('FINANCIAL_EVENT_FACT_RETENTION_REQUIRED');
    await expect(database.exec(`delete from runtime.inbox where consumer='proof' and event_id='inbox:pending'`)).rejects.toThrow('FINANCIAL_EVENT_FACT_RETENTION_REQUIRED');
    await database.exec(`delete from runtime.outbox where id='outbox:aged'`);
    await database.exec(`delete from runtime.inbox where consumer='proof' and event_id='inbox:aged'`);
    const retained = await database.query<{ outbox: number; inbox: number }>(`select
      (select count(*)::integer from runtime.outbox where id='outbox:aged') outbox,
      (select count(*)::integer from runtime.inbox where consumer='proof' and event_id='inbox:aged') inbox`);
    expect(retained.rows[0]).toEqual({ outbox: 0, inbox: 0 });
  });
});

async function issue(database: PGlite, tokenHash: string, assurance: string, idempotency: string, requestHash: string, session = currentSession): Promise<void> {
  await database.query(`select * from access.issue_action_proof($1,$2,$3,$4,$5,'finance.statements.export',null,$6,null,$7)`, [tokenHash, actor, session, membership, assurance, idempotency, requestHash]);
}

async function consume(database: PGlite, tokenHash: string, idempotency: string, requestHash: string, session = currentSession): Promise<boolean> {
  const result = await database.query<{ consumed: boolean }>(`select access.consume_action_proof($1,$2,$3,$4,$5,'finance.statements.export',$5,$6,null,$7) consumed`, [tokenHash, actor, session, membership, scope, idempotency, requestHash]);
  return result.rows[0]?.consumed === true;
}

async function resolvedSession(database: PGlite, tokenHash: string) {
  const result = await database.query<{ session_id: string; assurance_level: number; assurance_verified_at: Date | null }>(`select session_id,assurance_level,assurance_verified_at from identity.resolve_session($1)`, [tokenHash]);
  return result.rows[0];
}

async function invoiceVisibility(database: PGlite, targetScope: string): Promise<{ request: number; document: number; line: number; status: number }> {
  await database.query(`select set_config('app.scope_id',$1,false),set_config('app.membership_id','',false)`, [targetScope]);
  await database.exec('set role shopapp');
  try {
    const result = await database.query<{ request: number; document: number; line: number; status: number }>(`select
      (select count(*)::integer from invoice.request where id='request:rls') request,
      (select count(*)::integer from invoice.document where request_id='request:rls') document,
      (select count(*)::integer from invoice.line where request_id='request:rls') line,
      (select count(*)::integer from invoice.statusevent where request_id='request:rls') status`);
    return result.rows[0]!;
  } finally {
    await database.exec('reset role');
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function replayThroughFinanceSecurity(database: PGlite): Promise<void> {
  await database.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);`);
  const files = (await readdir(migrations)).filter((name) => name.endsWith('.sql') && name <= '20260828092000_finance_security_boundaries.sql').sort();
  for (const name of files) {
    if (name === '20260817191000_bootstrap_ethan_platform_owner.sql') await seedOwner(database);
    if (name === '20260821026000_backfill_domain_data.sql') await stageSecrets(database);
    await database.exec(await readFile(`${migrations}/${name}`, 'utf8'));
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
  }
}

async function seedOwner(database: PGlite): Promise<void> {
  await database.exec(`insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN',
      'Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status)
    values('${actor}','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username','ethan','${actor}');`);
}

async function stageSecrets(database: PGlite): Promise<void> {
  await database.exec(`insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),
      'fixture-v1',created_at from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),
      'fixture-v1',created_at from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),
      'fixture-v1',created_at from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`);
}
