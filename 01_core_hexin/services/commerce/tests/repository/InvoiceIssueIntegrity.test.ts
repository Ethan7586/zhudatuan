import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimedJob } from '../../src/foundation/application/JobRunner';
import type { OperationRequest } from '../../src/foundation/application/OperationHandler';
import type { KmsClient } from '../../src/foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../src/foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';
import type { InvoiceIssuer } from '../../src/modules/finance/03_application_yingyong/port/InvoiceIssuer';
import { getInvoicesOperations } from '../../src/modules/finance/03_application_yingyong/query/GetInvoices';
import { FinanceDeadletter } from '../../src/modules/finance/05_interface_jieru/job/FinanceDeadletter';
import { InvoiceJobProcessor } from '../../src/modules/finance/05_interface_jieru/job/InvoiceJob';

const migration = fileURLToPath(new URL('../../../../../02_platform_pingtai/database/supabase/migrations/20260828094000_finance_invoice_issue_integrity.sql', import.meta.url));
const sha256 = 'a'.repeat(64);

describe('invoice issue PostgreSQL integrity', () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await database.exec('create extension if not exists pgcrypto');
    await database.exec(baseSchema);
    await database.exec(await readFile(migration, 'utf8'));
    await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.workload','jobs',false)");
  });

  afterEach(async () => {
    await database.close();
  });

  it('fails migration when a historical request owner disagrees with its immutable snapshot', async () => {
    const legacy = new PGlite({ extensions: { pgcrypto } });
    try {
      await legacy.exec('create extension if not exists pgcrypto');
      await legacy.exec(baseSchema);
      await legacy.exec(`insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,
        taxid_token,taxid_key_version,status,version) values('profile:drift','scope:live','title','key:1','taxid',
        repeat('d',64),'key:1','active',0)`);
      await legacy.exec(`insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
        requested_by,reason,evidence,source_hash,kind) values('invoice:drift','profile:drift','settlement:invoice',100,
        'CNY','submitted',clock_timestamp(),0,'member:requester','request','{}',repeat('a',64),'original')`);
      await legacy.exec(`insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,
        taxid_token,taxid_key_version,profile_version) values('invoice:drift','scope:snapshot','title','key:1','taxid',
        repeat('d',64),'key:1',0)`);

      await expect(legacy.exec(await readFile(migration, 'utf8'))).rejects.toThrow('INVOICE_REQUEST_OWNER_SNAPSHOT_MISMATCH');
    } finally {
      await legacy.close();
    }
  });

  it('reads requests through the immutable owner snapshot rather than the live profile owner', async () => {
    await request(database, { id: 'invoice:scope-snapshot', amount: 100, lines: [['settlementline:scope-snapshot', 100, 10]] });
    await database.exec('alter table invoice.profile disable trigger invoice_profile_owner_immutable');
    await database.exec(`update invoice.profile set owner_id='scope:live-drift' where id='profile:invoice'`);
    await database.exec('alter table invoice.profile enable trigger invoice_profile_owner_immutable');
    const action = getInvoicesOperations()['invoice.requests.read'];
    if (typeof action !== 'function') throw new Error('TEST_INVOICE_READ_ACTION_MISSING');
    const readDatabase = pool(database);

    const visible = await action(invoiceReadRequest('scope:invoice'), readDatabase);
    const hidden = await action(invoiceReadRequest('scope:live-drift'), readDatabase);

    expect(visible.body).toMatchObject({ items: [expect.objectContaining({ id: 'invoice:scope-snapshot' })], count: 1 });
    expect(hidden.body).toMatchObject({ items: [], count: 0 });
  });

  it('validates one sealed snapshot, persists the receipt atomically and skips a completed replay', async () => {
    await request(database, {
      id: 'invoice:valid',
      amount: 100,
      lines: [
        ['settlementline:a', 60, 6],
        ['settlementline:b', 40, 4],
      ],
    });
    const issuer = vi.fn<InvoiceIssuer['issue']>(async () => ({
      externalId: 'provider:invoice:valid',
      provider: 'provider',
      document: pdf(),
      contentType: 'application/pdf',
    }));
    const fixture = objects();
    const processor = new InvoiceJobProcessor(pool(database), fixture.store, kms(), { issue: issuer });

    await processor.process(job('invoice:valid'), new AbortController().signal);
    await processor.process(job('invoice:valid'), new AbortController().signal);

    expect(issuer).toHaveBeenCalledOnce();
    expect(fixture.created).toHaveLength(1);
    expect(fixture.created[0]).toMatch(/^invoices\/[0-9a-f]{64}\.pdf$/);
    const result = await database.query<{ state: string; documents: number; statuses: number; outbox: number; artifacts: number }>(`select request.state,
      (select count(*)::integer from invoice.document where request_id=request.id) documents,
      (select count(*)::integer from invoice.statusevent where request_id=request.id) statuses,
      (select count(*)::integer from runtime.outbox where aggregate_id=request.id) outbox,
      (select count(*)::integer from invoice.issueartifact where request_id=request.id and state='final') artifacts
      from invoice.request request where id='invoice:valid'`);
    expect(result.rows[0]).toEqual({ state: 'issued', documents: 1, statuses: 3, outbox: 1, artifacts: 1 });
  });

  it('binds finalization to one unexpired claim and records a stale upload as an orphan', async () => {
    await request(database, { id: 'invoice:claim-race', amount: 100, lines: [['settlementline:claim', 100, 10]] });
    const first = await database.query<{ claim_token: string; claim_id: string }>(`select claim_token,claim_id
      from invoice.claim_issue('invoice:claim-race')`);
    await expect(database.query(`select * from invoice.claim_issue('invoice:claim-race')`)).rejects.toThrow('INVOICE_ALREADY_CLAIMED');
    await database.exec(`update invoice.request set issue_claim_until=clock_timestamp()-interval '1 second'
      where id='invoice:claim-race'`);
    const second = await database.query<{ claim_token: string; claim_id: string }>(`select claim_token,claim_id
      from invoice.claim_issue('invoice:claim-race')`);
    expect(second.rows[0]?.claim_token).not.toBe(first.rows[0]?.claim_token);
    expect(second.rows[0]?.claim_id).not.toBe(first.rows[0]?.claim_id);
    const stale = await database.query<{ accepted: boolean }>(
      `select invoice.register_issue_artifact(
      'invoice:claim-race',$1,'provider','external:stale','object:stale',$2) accepted`,
      [first.rows[0]?.claim_token, sha256]
    );
    expect(stale.rows[0]?.accepted).toBe(false);
    const artifact = await database.query<{ state: string }>(
      `select state from invoice.issueartifact
      where claim_hash=$1`,
      [first.rows[0]?.claim_id]
    );
    expect(artifact.rows[0]?.state).toBe('orphan');
  });

  it('fails closed before decrypting or calling the provider when amount or source hash is invalid', async () => {
    await request(database, { id: 'invoice:amount-mismatch', amount: 101, lines: [['settlementline:amount', 100, 10]], seal: false });
    await request(database, { id: 'invoice:hash-mismatch', amount: 100, lines: [['settlementline:hash', 100, 10]], sourceHash: 'b'.repeat(64), seal: false });
    const issuer = vi.fn<InvoiceIssuer['issue']>();
    const decrypt = vi.fn(async () => 'plaintext');
    const processor = new InvoiceJobProcessor(pool(database), objects().store, { decrypt } as unknown as KmsClient, { issue: issuer });

    await expect(processor.process(job('invoice:amount-mismatch'), new AbortController().signal)).rejects.toThrow('INVOICE_AMOUNT_MISMATCH');
    await expect(processor.process(job('invoice:hash-mismatch'), new AbortController().signal)).rejects.toThrow('INVOICE_SOURCE_HASH_MISMATCH');
    expect(decrypt).not.toHaveBeenCalled();
    expect(issuer).not.toHaveBeenCalled();
  });

  it('rejects approval-era line mutation and detects a legacy requestline/rendered-line mismatch before issue', async () => {
    await request(database, { id: 'invoice:immutable', amount: 100, lines: [['settlementline:immutable', 100, 10]] });
    await expect(database.exec(`update invoice.line set amount_minor=99 where request_id='invoice:immutable'`)).rejects.toThrow('INVOICE_SNAPSHOT_IMMUTABLE');
    await expect(
      database.exec(`insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor,source_line_id)
      values('invoice:immutable',2,'late append',1,0,'settlementline:late')`)
    ).rejects.toThrow('INVOICE_SNAPSHOT_SEALED');

    await request(database, {
      id: 'invoice:legacy-mismatch',
      amount: 100,
      lines: [
        ['settlementline:legacy-a', 60, 6],
        ['settlementline:legacy-b', 40, 4],
      ],
      seal: false,
    });
    await database.exec('alter table invoice.line disable trigger invoice_line_snapshot_guard');
    await database.exec(`update invoice.line set amount_minor=50 where request_id='invoice:legacy-mismatch' and sequence=1;
      update invoice.line set amount_minor=50 where request_id='invoice:legacy-mismatch' and sequence=2;`);
    await database.exec('alter table invoice.line enable trigger invoice_line_snapshot_guard');
    const issuer = vi.fn<InvoiceIssuer['issue']>();
    const processor = new InvoiceJobProcessor(pool(database), objects().store, kms(), { issue: issuer });
    await expect(processor.process(job('invoice:legacy-mismatch'), new AbortController().signal)).rejects.toThrow('INVOICE_LINE_SNAPSHOT_MISMATCH');
    expect(issuer).not.toHaveBeenCalled();
  });

  it('issues one immutable red document linked to the original and replays without a second provider call', async () => {
    await request(database, { id: 'invoice:original', amount: 100, lines: [['settlementline:red', 100, 10]] });
    const originalIssuer = vi.fn<InvoiceIssuer['issue']>(async () => ({
      externalId: 'provider:original',
      provider: 'provider',
      document: pdf(),
      contentType: 'application/pdf',
    }));
    await new InvoiceJobProcessor(pool(database), objects().store, kms(), { issue: originalIssuer }).process(job('invoice:original'), new AbortController().signal);
    await redRequest(database, 'invoice:red', 'invoice:original');
    const redIssuer = vi.fn<InvoiceIssuer['issue']>(async (input) => {
      expect(input.originalExternalId).toBe('provider:original');
      return { externalId: 'provider:red', provider: 'provider', document: pdf(), contentType: 'application/pdf' };
    });
    const processor = new InvoiceJobProcessor(pool(database), objects().store, kms(), { issue: redIssuer });

    await processor.process(job('invoice:red'), new AbortController().signal);
    await processor.process(job('invoice:red'), new AbortController().signal);

    expect(redIssuer).toHaveBeenCalledOnce();
    const result = await database.query<{ original_state: string; red_state: string; red_of: string; event: string }>(`select
      original.state original_state,red.state red_state,document.red_of_id red_of,outbox.event_type event
      from invoice.request original join invoice.request red on red.red_of_request_id=original.id
      join invoice.document document on document.request_id=red.id
      join runtime.outbox outbox on outbox.aggregate_id=red.id where original.id='invoice:original'`);
    expect(result.rows[0]).toEqual({ original_state: 'red', red_state: 'issued', red_of: 'document:invoice:original', event: 'invoice.red.issued' });
  });

  it('keeps a failed post-provider red attempt bound to its original invoice', async () => {
    await request(database, { id: 'invoice:original-uncertain-red', amount: 100, lines: [['settlementline:red-uncertain', 100, 10]] });
    await new InvoiceJobProcessor(pool(database), objects().store, kms(), {
      issue: async () => ({
        externalId: 'provider:original-uncertain-red',
        provider: 'provider',
        document: pdf(),
        contentType: 'application/pdf',
      }),
    }).process(job('invoice:original-uncertain-red'), new AbortController().signal);
    await redRequest(database, 'invoice:red-uncertain', 'invoice:original-uncertain-red');
    const issuer = vi.fn<InvoiceIssuer['issue']>(async () => ({
      externalId: 'provider:red-uncertain',
      provider: 'provider',
      document: pdf(),
      contentType: 'application/pdf',
    }));
    const fixture = objects(async () => {
      await database.exec(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
        occurred_at,available_at) values('event:finance:invoice:invoice:red-uncertain','invoice.issued',1,'invoice',
        'other','scope:invoice','{}','wrong',clock_timestamp(),clock_timestamp())`);
    });
    const processor = new InvoiceJobProcessor(pool(database), fixture.store, kms(), { issue: issuer });

    await expect(processor.process(job('invoice:red-uncertain'), new AbortController().signal)).rejects.toThrow('INVOICE_OUTBOX_CONFLICT');
    expect(issuer).toHaveBeenCalledOnce();
    await database.exec('begin');
    try {
      await new FinanceDeadletter().record(database, job('invoice:red-uncertain'), 'INVOICE_OUTBOX_CONFLICT');
      await database.exec('commit');
    } catch (cause) {
      await database.exec('rollback');
      throw cause;
    }

    await database.exec('set role shopapp');
    try {
      await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.actor_id','member:second-red-requester',false),set_config('app.workload','api',false)");
      await expect(
        database.exec(`select * from invoice.create_red_request('invoice:red-duplicate','invoice:original-uncertain-red',
          'duplicate','{}',3)`)
      ).rejects.toThrow('INVOICE_RED_NOT_ELIGIBLE');
    } finally {
      await database.exec('reset role');
    }
    const result = await database.query<{ original_state: string; red_state: string; duplicate: number }>(`select original.state original_state,
      red.state red_state,(select count(*)::integer from invoice.request where id='invoice:red-duplicate') duplicate
      from invoice.request original join invoice.request red on red.red_of_request_id=original.id
      where original.id='invoice:original-uncertain-red'`);
    expect(result.rows[0]).toEqual({ original_state: 'issued', red_state: 'failed', duplicate: 0 });
  });

  it('rolls back document and status changes when an outbox id has conflicting evidence', async () => {
    await database.exec(`insert into finance.settlementline(id,settlement_id,scope_id,source_type,source_id,amount_minor,
      invoice_minor,tax_minor,direction,state) values('settlementline:conflict','settlement:invoice','scope:invoice',
      'payment','payment:conflict',100,100,10,'increase','frozen')`);
    await request(database, { id: 'invoice:outbox-conflict', amount: 100, lines: [['settlementline:conflict', 100, 10]] });
    const fixture = objects(async () => {
      await database.exec(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
        occurred_at,available_at) values('event:finance:invoice:invoice:outbox-conflict','invoice.red.issued',1,'invoice',
        'other','scope:invoice','{}','wrong',clock_timestamp(),clock_timestamp())`);
    });
    const issuer = vi.fn<InvoiceIssuer['issue']>(async () => ({
      externalId: 'provider:outbox-conflict',
      provider: 'provider',
      document: pdf(),
      contentType: 'application/pdf',
    }));
    const processor = new InvoiceJobProcessor(pool(database), fixture.store, kms(), { issue: issuer });

    await expect(processor.process(job('invoice:outbox-conflict'), new AbortController().signal)).rejects.toThrow('INVOICE_OUTBOX_CONFLICT');
    expect(issuer).toHaveBeenCalledOnce();
    const result = await database.query<{ state: string; documents: number; statuses: number }>(`select request.state,
      (select count(*)::integer from invoice.document where request_id=request.id) documents,
      (select count(*)::integer from invoice.statusevent where request_id=request.id) statuses
      from invoice.request request where id='invoice:outbox-conflict'`);
    expect(result.rows[0]).toEqual({ state: 'issuing', documents: 0, statuses: 2 });
    const artifact = await database.query<{ state: string }>(`select state from invoice.issueartifact
      where request_id='invoice:outbox-conflict'`);
    expect(artifact.rows[0]?.state).toBe('orphan');

    await database.exec('begin');
    try {
      await new FinanceDeadletter().record(database, job('invoice:outbox-conflict'), 'INVOICE_OUTBOX_CONFLICT');
      await database.exec('commit');
    } catch (cause) {
      await database.exec('rollback');
      throw cause;
    }
    await database.exec('set role shopapp');
    try {
      await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.actor_id','member:second-requester',false),set_config('app.workload','api',false)");
      await expect(
        database.exec(`select * from invoice.create_request('invoice:duplicate-after-provider','profile:invoice',
          'settlement:invoice',100,array['settlementline:conflict'],'duplicate','{}',7)`)
      ).rejects.toThrow('INVOICE_LINES_NOT_ELIGIBLE_OR_AMOUNT_MISMATCH');
    } finally {
      await database.exec('reset role');
    }
    const failed = await database.query<{ state: string; statuses: number; duplicates: number }>(`select request.state,
      (select count(*)::integer from invoice.statusevent where request_id=request.id) statuses,
      (select count(*)::integer from invoice.request where id='invoice:duplicate-after-provider') duplicates
      from invoice.request request where id='invoice:outbox-conflict'`);
    expect(failed.rows[0]).toEqual({ state: 'failed', statuses: 3, duplicates: 0 });
  });

  it('removes direct worker and API writes to every critical invoice fact', async () => {
    await request(database, { id: 'invoice:deadletter', amount: 100, lines: [['settlementline:deadletter', 100, 10]] });
    await database.exec(`select * from invoice.claim_issue('invoice:deadletter')`);
    await database.exec('set role shopjob');
    try {
      await database.exec(`select set_config('app.scope_id','scope:invoice',false),set_config('app.workload','jobs',false)`);
      await database.exec(`select invoice.fail_issue('invoice:deadletter','job:deadletter','terminal failure')`);
      await expect(database.exec(`update invoice.request set amount_minor=99 where id='invoice:deadletter'`)).rejects.toThrow(/permission denied/i);
    } finally {
      await database.exec('reset role');
    }
    const failed = await database.query<{ state: string; statuses: number }>(`select state,
      (select count(*)::integer from invoice.statusevent where request_id=request.id) statuses
      from invoice.request request where id='invoice:deadletter'`);
    expect(failed.rows[0]).toEqual({ state: 'failed', statuses: 3 });
    await database.exec('set role shopapp');
    try {
      await expect(
        database.exec(`update invoice.request set state='issued',version=version+1
        where id='invoice:deadletter'`)
      ).rejects.toThrow(/permission denied/i);
      await expect(
        database.exec(`insert into invoice.statusevent(request_id,sequence,state,occurred_at)
        values('invoice:deadletter',4,'issued',clock_timestamp())`)
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await database.exec('reset role');
    }
    const privileges = await database.query<{ role: string; relation: string; insertable: boolean; updateable: boolean; deletable: boolean }>(`
      select role,relation,has_table_privilege(role,'invoice.'||relation,'INSERT') insertable,
        has_table_privilege(role,'invoice.'||relation,'UPDATE') updateable,
        has_table_privilege(role,'invoice.'||relation,'DELETE') deletable
      from unnest(array['shopapp','shopjob']) role
      cross join unnest(array['document','line','requestline','requestprofile','statusevent']) relation
      order by role,relation`);
    expect(privileges.rows.filter(({ role }) => role === 'shopjob').every(({ insertable, updateable, deletable }) => !insertable && !updateable && !deletable)).toBe(true);
    expect(privileges.rows.find(({ role, relation }) => role === 'shopapp' && relation === 'document')).toEqual({ role: 'shopapp', relation: 'document', insertable: false, updateable: false, deletable: false });
    expect(privileges.rows.filter(({ role }) => role === 'shopapp').every(({ insertable, updateable, deletable }) => !insertable && !updateable && !deletable)).toBe(true);
    expect(privileges.rows.find(({ role, relation }) => role === 'shopapp' && relation === 'statusevent')).toEqual({
      role: 'shopapp',
      relation: 'statusevent',
      insertable: false,
      updateable: false,
      deletable: false,
    });
  });

  it('assembles an original request from authoritative frozen lines and audits every controlled transition', async () => {
    await database.exec(`insert into finance.settlementline(id,settlement_id,scope_id,source_type,source_id,amount_minor,
      invoice_minor,tax_minor,direction,state) values
      ('settlementline:controlled-a','settlement:invoice','scope:invoice','payment','payment:a',60,60,6,'increase','frozen'),
      ('settlementline:controlled-b','settlement:invoice','scope:invoice','payment','payment:b',40,40,4,'increase','frozen')`);

    await database.exec('set role shopapp');
    try {
      await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.actor_id','member:requester',false),set_config('app.workload','api',false)");
      const created = await database.query<{ id: string; amount_minor: number }>(
        `select id,amount_minor::integer from invoice.create_request(
          'invoice:controlled','profile:invoice','settlement:invoice',100,
          array['settlementline:controlled-a','settlementline:controlled-b'],'request','{}',7)`
      );
      expect(created.rows[0]).toEqual({ id: 'invoice:controlled', amount_minor: 100 });
      await expect(
        database.exec(`insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
          requested_by,reason,evidence,source_hash,kind)
          values('invoice:fabricated','profile:invoice','settlement:invoice',1,'CNY','submitted',clock_timestamp(),0,
          'member:requester','fabricated','{}',repeat('a',64),'original')`)
      ).rejects.toThrow(/permission denied/i);
      await expect(database.exec(`update invoice.profile set owner_id='scope:other' where id='profile:invoice'`)).rejects.toThrow('INVOICE_PROFILE_OWNER_IMMUTABLE');
    } finally {
      await database.exec('reset role');
    }
    const scope = await database.query<{ scope: string }>(`select finance.resource_scope('invoice:controlled') scope`);
    expect(scope.rows[0]?.scope).toBe('scope:invoice');

    await consumeProof(database, {
      actor: 'member:reviewer',
      operation: 'invoice.requests.decide',
      resource: 'invoice:controlled',
      expectedVersion: 0,
      statement: `select * from invoice.decide_request('invoice:controlled','approved','approved','{"review":"ok"}',0)`,
    });
    await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.workload','jobs',false)");
    await database.exec(`select * from invoice.claim_issue('invoice:controlled')`);
    await database.exec('set role shopjob');
    try {
      await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.workload','jobs',false)");
      await database.exec(`select invoice.fail_issue('invoice:controlled','job:controlled','terminal')`);
    } finally {
      await database.exec('reset role');
    }

    const result = await database.query<{ states: string[]; profile_version: number; total: number; tax: number }>(`select
      array(select state from invoice.statusevent where request_id=request.id order by sequence) states,
      (select profile_version::integer from invoice.requestprofile where request_id=request.id) profile_version,
      (select sum(amount_minor)::integer from invoice.requestline where request_id=request.id) total,
      (select sum(tax_minor)::integer from invoice.requestline where request_id=request.id) tax
      from invoice.request request where id='invoice:controlled'`);
    expect(result.rows[0]).toEqual({ states: ['submitted', 'approved', 'issuing', 'failed'], profile_version: 1, total: 100, tax: 10 });
  });

  it('rejects a cross-scope invoice worker before decrypt or provider access', async () => {
    await request(database, { id: 'invoice:wrong-scope', amount: 100, lines: [['settlementline:wrong-scope', 100, 10]] });
    const decrypt = vi.fn(async () => 'plaintext');
    const issuer = vi.fn<InvoiceIssuer['issue']>();
    const processor = new InvoiceJobProcessor(pool(database), objects().store, { decrypt } as unknown as KmsClient, { issue: issuer });

    await expect(processor.process({ ...job('invoice:wrong-scope'), scope_id: 'scope:other' }, new AbortController().signal)).rejects.toThrow('INVOICE_JOB_SCOPE_INVALID');
    expect(decrypt).not.toHaveBeenCalled();
    expect(issuer).not.toHaveBeenCalled();
  });

  it('records immutable rejected and cancelled transitions through controlled functions', async () => {
    await request(database, {
      id: 'invoice:rejected',
      amount: 100,
      lines: [['settlementline:rejected', 100, 10]],
      approve: false,
    });
    await consumeProof(database, {
      actor: 'member:reviewer',
      operation: 'invoice.requests.decide',
      resource: 'invoice:rejected',
      expectedVersion: 0,
      statement: `select * from invoice.decide_request('invoice:rejected','rejected','invalid','{}',0)`,
    });
    await request(database, {
      id: 'invoice:cancelled',
      amount: 100,
      lines: [['settlementline:cancelled', 100, 10]],
      approve: false,
    });
    await database.exec('set role shopapp');
    try {
      await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.actor_id','member:requester',false),set_config('app.workload','api',false)");
      await database.exec(`select * from invoice.cancel_request('invoice:cancelled',0)`);
    } finally {
      await database.exec('reset role');
    }
    const states = await database.query<{ request_id: string; states: string[] }>(`select request.id request_id,
      array(select state from invoice.statusevent where request_id=request.id order by sequence) states
      from invoice.request request where request.id in('invoice:rejected','invoice:cancelled') order by request.id`);
    expect(states.rows).toEqual([
      { request_id: 'invoice:cancelled', states: ['submitted', 'cancelled'] },
      { request_id: 'invoice:rejected', states: ['submitted', 'rejected'] },
    ]);
  });

  it('moves a terminal pre-claim failure to audited failed state through the deadletter path', async () => {
    await request(database, { id: 'invoice:preclaim-deadletter', amount: 100, lines: [['settlementline:preclaim', 100, 10]] });
    await database.exec("select set_config('app.scope_id','scope:other',false),set_config('app.workload','api',false)");

    await database.exec('begin');
    try {
      await new FinanceDeadletter().record(database, job('invoice:preclaim-deadletter'), 'INVOICE_SOURCE_HASH_MISMATCH');
      await database.exec('commit');
    } catch (cause) {
      await database.exec('rollback');
      throw cause;
    }

    const result = await database.query<{ state: string; states: string[]; evidence: Record<string, unknown> }>(`select request.state,
      array(select state from invoice.statusevent where request_id=request.id order by sequence) states,request.evidence
      from invoice.request request where id='invoice:preclaim-deadletter'`);
    expect(result.rows[0]).toEqual({
      state: 'failed',
      states: ['submitted', 'failed'],
      evidence: { deadletter: 'job:job:invoice:preclaim-deadletter', error: 'INVOICE_SOURCE_HASH_MISMATCH' },
    });
  });

  it('enforces tax not exceeding amount at every invoice and settlement boundary', async () => {
    await expect(database.exec(`insert into finance.statementline(id,amount_minor,tax_minor) values('statementline:bad-tax',100,101)`)).rejects.toThrow(/finance_statementline_tax_within_amount/i);
    await expect(database.exec(`insert into finance.settlementadjustment(id,amount_minor,tax_minor) values('adjustment:bad-tax',100,101)`)).rejects.toThrow(/finance_settlementadjustment_tax_basis/i);
    await expect(
      database.exec(`insert into finance.settlementline(id,settlement_id,scope_id,source_type,source_id,amount_minor,
        invoice_minor,tax_minor,direction,state) values('settlementline:bad-tax','settlement:invoice','scope:invoice',
        'payment','payment:bad-tax',100,100,101,'increase','frozen')`)
    ).rejects.toThrow(/finance_settlementline_tax_basis/i);
    await expect(request(database, { id: 'invoice:bad-tax', amount: 100, lines: [['settlementline:bad-tax-request', 100, 101]], seal: false })).rejects.toThrow(/invoice_requestline_tax_within_amount/i);
  });
});

async function consumeProof(database: PGlite, input: Readonly<{ actor: string; operation: string; resource: string; expectedVersion: number; statement: string }>): Promise<void> {
  await database.exec('begin');
  try {
    await database.query(
      `insert into access.actionproof(token_hash,actor_id,scope_id,operation,resource_id,expected_version,consumed_at,expires_at)
      values($1,$2,'scope:invoice',$3,$4,$5,clock_timestamp(),clock_timestamp()+interval '5 minutes')`,
      [createHash('sha256').update(`${input.operation}:${input.resource}:${input.actor}`).digest('hex'), input.actor, input.operation, input.resource, input.expectedVersion]
    );
    await database.exec('set role shopapp');
    await database.query("select set_config('app.scope_id','scope:invoice',true),set_config('app.actor_id',$1,true),set_config('app.workload','api',true)", [input.actor]);
    await database.exec(input.statement);
    await database.exec('reset role');
    await database.exec('commit');
  } catch (cause) {
    await database.exec('rollback');
    await database.exec('reset role');
    throw cause;
  }
}

async function request(
  database: PGlite,
  input: Readonly<{
    id: string;
    amount: number;
    lines: readonly (readonly [string, number, number])[];
    sourceHash?: string;
    seal?: boolean;
    approve?: boolean;
  }>
): Promise<void> {
  const sourceHash = input.sourceHash ?? hash(input.lines);
  await database.query(
    `insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
    requested_by,approved_by,reason,evidence,source_hash,kind,red_of_request_id)
    values($1,'profile:invoice','settlement:invoice',$2,'CNY','submitted',clock_timestamp(),0,
      'member:requester',null,'request','{}',$3,'original',null)`,
    [input.id, input.amount, sourceHash]
  );
  await database.query(
    `insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,
    taxid_token,taxid_key_version,address_ciphertext,address_key_version,profile_version)
    values($1,'scope:invoice','ciphertext-title-0001','key:1','ciphertext-taxid-0001',$2,'key:1',null,null,1)`,
    [input.id, 'c'.repeat(64)]
  );
  for (const [source, amount, tax] of input.lines) {
    await database.query(
      `insert into invoice.requestline(id,request_id,settlement_line_id,kind,amount_minor,tax_minor,source_hash)
      values($1,$2,$3,'original',$4,$5,$6)`,
      [`requestline:${input.id}:${source}`, input.id, source, amount, tax, lineHash(source, amount, tax)]
    );
  }
  for (const [index, [source, amount, tax]] of input.lines.entries()) {
    await database.query(
      `insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor,source_line_id)
      values($1,$2,$3,$4,$5,$6)`,
      [input.id, index + 1, `order:${source}`, amount, tax, source]
    );
  }
  if (input.seal !== false)
    await database.query(
      `insert into invoice.statusevent(request_id,sequence,state,occurred_at)
    values($1,1,'submitted',clock_timestamp())`,
      [input.id]
    );
  if (input.approve !== false) await database.query(`update invoice.request set state='approved',approved_by='member:reviewer',version=version+1 where id=$1`, [input.id]);
}

async function redRequest(database: PGlite, id: string, original: string): Promise<void> {
  const source = await database.query<{ version: number }>(`select version::integer from invoice.request where id=$1`, [original]);
  const version = source.rows[0]?.version;
  if (version === undefined) throw new Error('TEST_ORIGINAL_MISSING');
  await database.exec('begin');
  try {
    await database.query(
      `insert into access.actionproof(token_hash,actor_id,scope_id,operation,resource_id,expected_version,consumed_at,expires_at)
      values($1,'member:red-requester','scope:invoice','invoice.requests.red',$2,$3,clock_timestamp(),clock_timestamp()+interval '5 minutes')`,
      [createHash('sha256').update(`red:${original}`).digest('hex'), original, version]
    );
    await database.exec('set role shopapp');
    await database.exec("select set_config('app.scope_id','scope:invoice',true),set_config('app.actor_id','member:red-requester',true),set_config('app.workload','api',true)");
    await database.query(`select * from invoice.create_red_request($1,$2,'red','{}',$3)`, [id, original, version]);
    await database.exec('reset role');
    await database.exec('commit');
  } catch (cause) {
    await database.exec('rollback');
    await database.exec('reset role');
    throw cause;
  }
  await consumeProof(database, {
    actor: 'member:red-reviewer',
    operation: 'invoice.requests.decide',
    resource: id,
    expectedVersion: 0,
    statement: `select * from invoice.decide_request('${id}','approved','approved','{}',0)`,
  });
  await database.exec("select set_config('app.scope_id','scope:invoice',false),set_config('app.workload','jobs',false)");
}

function hash(lines: readonly (readonly [string, number, number])[]): string {
  return createHash('sha256')
    .update(
      [...lines]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([source, amount, tax]) => `${source}:${amount}:${tax}`)
        .join(',')
    )
    .digest('hex');
}
function lineHash(source: string, amount: number, tax: number): string {
  return createHash('sha256').update(`${source}:${amount}:${tax}`).digest('hex');
}
function job(request: string): ClaimedJob {
  return { id: `job:${request}`, kind: 'invoice', scope_id: 'scope:invoice', payload: { request }, attempts: 1 };
}
function invoiceReadRequest(scope: string): OperationRequest {
  return {
    type: 'invoice.requests.read',
    access: {
      actor: {
        id: 'member:reader',
        session: 'session:reader',
        membership: 'membership:reader',
        credentialVersion: 1,
        accessVersion: 1,
        target: 'console',
        assurance: { level: 1 },
      },
      membership: { id: 'membership:reader', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { kind: 'mall', id: scope, path: [] },
      accessVersion: 1,
      capabilities: ['invoice.requests.read'],
      assurance: { level: 1 },
      trace: 'trace:invoice-read',
    },
    input: {
      path: {},
      query: { limit: '50' },
      headers: {},
      body: null,
      rawBody: '',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
    },
  };
}
function pdf(): Uint8Array {
  return new TextEncoder().encode('%PDF-invoice');
}
function kms(): KmsClient {
  return { decrypt: async () => 'plaintext' } as unknown as KmsClient;
}
function pool(database: PGlite): DatabasePool {
  const query = (text: string, values?: readonly unknown[]) => database.query(text, values === undefined ? undefined : [...values]);
  const adapter = { query, connect: async () => ({ query, release: () => undefined }), workload: () => adapter, end: async () => database.close() };
  return adapter as unknown as DatabasePool;
}
function objects(onComplete?: () => Promise<void>): { store: ObjectStore; created: string[] } {
  const created: string[] = [];
  const store = {
    create: async (path: string) => {
      created.push(path);
      return {
        append: async () => undefined,
        complete: async () => {
          await onComplete?.();
          return { reference: `object:${path}`, sha256, size: 12, scan: 'clean' as const };
        },
        abort: async () => undefined,
      };
    },
  } as unknown as ObjectStore;
  return { store, created };
}

const baseSchema = `
  create role shopapp; create role shopjob;
  create schema invoice; create schema finance; create schema runtime; create schema access;
  create table access.actionproof(
    token_hash char(64) primary key,actor_id text not null,scope_id text not null,operation text not null,
    resource_id text not null,expected_version bigint,consumed_at timestamptz,expires_at timestamptz not null);
  create table finance.statementline(id text primary key,amount_minor bigint not null,tax_minor bigint not null);
  create table finance.settlementadjustment(
    id text primary key,scope_id text not null default 'scope:invoice',amount_minor bigint not null,tax_minor bigint not null,
    constraint finance_settlementadjustment_tax_basis check(tax_minor<=amount_minor));
  create table finance.reconciliation(id text primary key,scope_id text not null);
  create table finance.withdrawal(id text primary key,scope_id text not null);
  create table finance.hold(id text primary key,scope_id text not null);
  create table finance.periodclose(id text primary key,scope_id text not null);
  create table finance.backfill(id text primary key,scope_id text not null);
  create table finance.policy(id text primary key,scope_id text not null);
  create table finance.statement(id text primary key,scope_id text not null);
  create table finance.account(id text primary key,scope_id text not null);
  create table finance.settlement(
    id text primary key,scope_id text not null,state text not null,version bigint not null,currency char(3) not null);
  create table finance.settlementline(
    id text primary key,settlement_id text not null references finance.settlement(id),scope_id text not null,
    source_type text not null,source_id text not null,amount_minor bigint not null,invoice_minor bigint not null,
    tax_minor bigint not null,direction text not null,state text not null,
    constraint finance_settlementline_tax_basis check(tax_minor<=amount_minor));
  create table invoice.profile(
    id text primary key,owner_id text not null,title_ciphertext text not null,title_key_version text not null,
    taxid_ciphertext text not null,taxid_token char(64) not null,taxid_key_version text not null,
    address_ciphertext text,address_key_version text,status text not null,version bigint not null);
  create table invoice.request(
    id text primary key,profile_id text not null references invoice.profile(id),settlement_id text,amount_minor bigint not null,
    currency char(3) not null,state text not null,created_at timestamptz not null,version bigint not null default 0,
    requested_by text,approved_by text,reason text,evidence jsonb not null default '{}',source_hash char(64),kind text not null,
    red_of_request_id text references invoice.request(id));
  create table invoice.document(
    id text primary key,request_id text not null unique references invoice.request(id),provider text not null,external_id text not null,
    object_ref text not null,sha256 char(64) not null,issued_at timestamptz not null,kind text not null,
    red_of_id text references invoice.document(id),unique(provider,external_id));
  create table invoice.requestline(
    id text primary key,request_id text not null references invoice.request(id),settlement_line_id text not null,kind text not null,
    amount_minor bigint not null,tax_minor bigint not null,source_hash char(64) not null,unique(request_id,settlement_line_id));
  create table invoice.requestprofile(
    request_id text primary key references invoice.request(id),owner_id text not null,title_ciphertext text not null,
    title_key_version text not null,taxid_ciphertext text not null,taxid_token char(64) not null,taxid_key_version text not null,
    address_ciphertext text,address_key_version text,profile_version bigint not null);
  create table invoice.line(
    request_id text not null references invoice.request(id),sequence integer not null,description text not null,
    amount_minor bigint not null,tax_minor bigint not null,source_line_id text,primary key(request_id,sequence));
  create table invoice.statusevent(
    request_id text not null references invoice.request(id),sequence integer not null,state text not null,reason text,
    occurred_at timestamptz not null,primary key(request_id,sequence));
  create table runtime.outbox(
    id text primary key,event_type text not null,event_version integer not null,aggregate_type text not null,aggregate_id text not null,
    scope_id text not null,payload jsonb not null,trace_id text not null,occurred_at timestamptz not null,available_at timestamptz not null);
  create table runtime.schemaversion(version text primary key,checksum char(64) not null);
  insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
    taxid_key_version,address_ciphertext,address_key_version,status,version)
  values('profile:invoice','scope:invoice','ciphertext-title-0001','key:1','ciphertext-taxid-0001',
    repeat('c',64),'key:1',null,null,'active',1);
  insert into finance.settlement(id,scope_id,state,version,currency)
  values('settlement:invoice','scope:invoice','payable',7,'CNY');
  grant usage on schema invoice,finance,runtime to shopapp,shopjob;
  grant select,insert,update,delete on all tables in schema invoice,finance,runtime to shopapp,shopjob;
`;
