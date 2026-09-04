import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OperationRequest } from '../../src/foundation/application/OperationHandler';
import type { OperationDatabase } from '../../src/foundation/application/ModuleOperations';
import type { ObjectStore } from '../../src/foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';
import { ReconcileStatement } from '../../src/modules/finance/03_application_yingyong/command/ReconcileStatement';
import { resolveDifferenceOperations } from '../../src/modules/finance/03_application_yingyong/command/ResolveDifference';

const migration = fileURLToPath(new URL('../../../../../02_platform_pingtai/database/supabase/migrations/20260828091000_finance_reconciliation_integrity.sql', import.meta.url));
const period = Object.freeze({ start: '2026-08-28', end: '2026-08-28', timezone: 'Asia/Shanghai' });

describe('finance reconciliation PostgreSQL contract', () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await database.exec('create extension if not exists pgcrypto');
    await database.exec(baseSchema);
    await database.exec(await readFile(migration, 'utf8'));
  });

  afterEach(async () => {
    await database.close();
  });

  it('keeps identical provider files distinct by Scope and rejects a mismatched statement reference', async () => {
    const hash = 'c'.repeat(64);
    await database.exec(`insert into channel.statement(id,provider,scope_id,partner_id,period_start,period_end,timezone,object_ref,sha256)
      values('statement:scope:a','wechat','scope:a','partner:a','2026-08-28','2026-08-28','Asia/Shanghai','object:a','${hash}'),
        ('statement:scope:b','wechat','scope:b','partner:b','2026-08-28','2026-08-28','Asia/Shanghai','object:b','${hash}');
      insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,created_by,evidence)
      values('reconciliation:scope:a','scope:a','wechat','partner:a','2026-08-28/2026-08-28','statement:scope:a','${hash}','received','tester','{}'),
        ('reconciliation:scope:b','scope:b','wechat','partner:b','2026-08-28/2026-08-28','statement:scope:b','${hash}','received','tester','{}');`);
    const isolated = await database.query<{ count: number }>(`select count(*)::integer count from finance.reconciliation
      where id in('reconciliation:scope:a','reconciliation:scope:b')`);
    expect(isolated.rows[0]?.count).toBe(2);
    await expect(
      database.exec(`insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,
      statement_hash,state,created_by,evidence) values('reconciliation:scope:mismatch','scope:b','wechat','partner:b',
      '2026-08-28/2026-08-28','statement:scope:a','${hash}','received','tester','{}')`)
    ).rejects.toThrow('FINANCE_RECONCILIATION_STATEMENT_MISMATCH');
  });

  it('backfills legacy item kind/source and enforces one item per internal fact', async () => {
    await database.close();
    database = new PGlite({ extensions: { pgcrypto } });
    await database.exec('create extension if not exists pgcrypto');
    await database.exec(baseSchema);
    await database.exec(`
      insert into channel.statement(id,provider,scope_id,partner_id,period_start,period_end,timezone,object_ref,sha256)
      values('statement:legacy','wechat','scope:finance','partner:finance','2026-08-28','2026-08-28','Asia/Shanghai',
        'object:legacy',repeat('a',64));
      insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,created_by,evidence)
      values('reconciliation:legacy','scope:finance','wechat','partner:finance','2026-08-28/2026-08-28','statement:legacy',
        repeat('a',64),'difference','tester','{}');
      insert into finance.statementline(id,reconciliation_id,scope_id,sequence,external_reference,kind,amount_minor,tax_minor,currency,raw_hash)
      values('statementline:legacy','reconciliation:legacy','scope:finance',1,'wx-legacy','payment',10,0,'CNY',repeat('b',64));
      insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,scope_id,external_minor,internal_minor,difference_minor,
        state,reason_code,evidence,version) values('reconciliationitem:legacy','reconciliation:legacy','statementline:legacy',
        'scope:finance',10,0,10,'difference','INTERNAL_REFERENCE_MISSING','{"legacy":true}',0);
    `);
    await database.exec(await readFile(migration, 'utf8'));
    const migrated = await database.query<{ kind: string; source: string }>(`select kind,evidence->>'source' source
      from finance.reconciliationitem where id='reconciliationitem:legacy'`);
    expect(migrated.rows[0]).toEqual({ kind: 'payment', source: 'provider_statement' });
    await database.exec(`insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,scope_id,kind,internal_type,internal_id,
      external_minor,internal_minor,difference_minor,state,reason_code,evidence,version)
      values('reconciliationitem:internal-one','reconciliation:legacy',null,'scope:finance','payment','payment','payment:legacy',
        0,10,-10,'difference','EXTERNAL_REFERENCE_MISSING','{"source":"finance_journal","kind":"payment"}',0)`);
    await expect(
      database.exec(`insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,scope_id,kind,internal_type,internal_id,
      external_minor,internal_minor,difference_minor,state,reason_code,evidence,version)
      values('reconciliationitem:internal-two','reconciliation:legacy',null,'scope:finance','payment','payment','payment:legacy',
        0,10,-10,'difference','EXTERNAL_REFERENCE_MISSING','{"source":"finance_journal","kind":"payment"}',0)`)
    ).rejects.toThrow(/finance_reconciliationitem_internal_fact|unique constraint/i);
  });

  it('reconciles the captured external tender and only the succeeded partial refund leg', async () => {
    await paymentFact(database, { id: 'mixed', external: 'wx-payment-mixed', total: 1_000, wechat: 400 });
    await refundFact(database, { id: 'partial', payment: 'mixed', external: 'wx-refund-partial', total: 300, wechat: 120 });
    const csv = statement([
      ['wx-payment-mixed', 'payment', 400],
      ['wx-refund-partial', 'refund', 120],
    ]);
    await reconcile(database, 'mixed-partial', csv);

    const result = await database.query<{ state: string; debit: number; credit: number; difference: number }>(`select state,
      debit_minor::float8 debit,credit_minor::float8 credit,difference_minor::float8 difference
      from finance.reconciliation where id='reconciliation:mixed-partial'`);
    expect(result.rows[0]).toEqual({ state: 'balanced', debit: 280, credit: 280, difference: 0 });
    const items = await database.query<{ kind: string; external: number; internal: number; state: string; reason: string | null }>(`select kind,
      external_minor::float8 external,internal_minor::float8 internal,state,reason_code reason
      from finance.reconciliationitem order by kind`);
    expect(items.rows).toEqual([
      { kind: 'payment', external: 400, internal: 400, state: 'matched', reason: null },
      { kind: 'refund', external: 120, internal: 120, state: 'matched', reason: null },
    ]);
    const evidence = await database.query<{ statement: string; internal: string; tender: number; allocations: number }>(`select
      evidence->>'source' statement,evidence->'candidates'->0->>'source' internal,
      (evidence->'candidates'->0->'tender'->>'amountMinor')::integer tender,
      (evidence->'candidates'->0->>'allocationCount')::integer allocations
      from finance.reconciliationitem where kind='payment'`);
    expect(evidence.rows[0]).toEqual({ statement: 'provider_statement', internal: 'authoritative_payment_tender', tender: 400, allocations: 1 });
  });

  it('creates both external-without-internal and internal-without-external differences idempotently', async () => {
    await paymentFact(database, { id: 'internal-only', external: 'wx-internal-only', total: 250, wechat: 100 });
    const csv = statement([['wx-external-only', 'payment', 70]]);
    await reconcile(database, 'bidirectional', csv);

    const first = await database.query<{ id: string; statement: string | null; external: number; internal: number; reason: string }>(`select id,
      statement_line_id statement,external_minor::float8 external,internal_minor::float8 internal,reason_code reason
      from finance.reconciliationitem order by id`);
    expect(first.rows).toHaveLength(2);
    expect(first.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statement: 'statementline:reconciliation:bidirectional:1', external: 70, internal: 0, reason: 'INTERNAL_REFERENCE_MISSING' }),
        expect.objectContaining({ statement: null, external: 0, internal: 100, reason: 'EXTERNAL_REFERENCE_MISSING' }),
      ])
    );
    const internalEvidence = await database.query<{ source: string; kind: string; journal: string }>(`select evidence->>'source' source,
      evidence->>'kind' kind,evidence->>'journal' journal from finance.reconciliationitem where statement_line_id is null`);
    expect(internalEvidence.rows[0]).toEqual({ source: 'authoritative_payment_tender', kind: 'payment', journal: 'journal:payment:internal-only' });

    await reconcile(database, 'bidirectional', csv);
    const replay = await database.query<{ id: string }>(`select id from finance.reconciliationitem order by id`);
    expect(replay.rows.map(({ id }) => id)).toEqual(first.rows.map(({ id }) => id));
    const summary = await database.query<{ state: string; debit: number; credit: number; difference: number }>(`select state,
      debit_minor::float8 debit,credit_minor::float8 credit,difference_minor::float8 difference
      from finance.reconciliation where id='reconciliation:bidirectional'`);
    expect(summary.rows[0]).toEqual({ state: 'difference', debit: 70, credit: 100, difference: -30 });
  });

  it('merges retry projections when an authoritative provider reference arrives later', async () => {
    await paymentFact(database, { id: 'retry-merge', external: 'wx-reference-before-refresh', total: 180, wechat: 180 });
    const csv = statement([['wx-reference-after-refresh', 'payment', 180]]);
    await reconcile(database, 'retry-merge', csv);
    const before = await database.query<{ count: number }>(`select count(*)::integer count from finance.reconciliationitem
      where reconciliation_id='reconciliation:retry-merge'`);
    expect(before.rows[0]?.count).toBe(2);

    await database.exec(`update payment.attempt set external_transaction='wx-reference-after-refresh'
      where id='attempt:retry-merge'`);
    await reconcile(database, 'retry-merge', csv);

    const after = await database.query<{ count: number; state: string; reason: string | null; statement: string; merged: string }>(`select
      count(*) over()::integer count,item.state,item.reason_code reason,item.statement_line_id statement,
      item.evidence->'retryMerge'->>'reason' merged from finance.reconciliationitem item
      where item.reconciliation_id='reconciliation:retry-merge'`);
    expect(after.rows).toEqual([
      {
        count: 1,
        state: 'matched',
        reason: null,
        statement: 'statementline:reconciliation:retry-merge:1',
        merged: 'REFERENCE_BECAME_AUTHORITATIVE',
      },
    ]);
    const parent = await database.query<{ state: string; difference: string }>(`select state,difference_minor::text difference
      from finance.reconciliation where id='reconciliation:retry-merge'`);
    expect(parent.rows[0]).toEqual({ state: 'balanced', difference: '0' });
  });

  it.each([
    ['reversal_of', 'INTERNAL_JOURNAL_REVERSED', 'journalReversal'],
    ['correction_of', 'INTERNAL_JOURNAL_CORRECTED', 'journalCorrection'],
  ] as const)('fails closed when the source journal has a posted %s relation', async (relation, reason, evidenceKey) => {
    await paymentFact(database, { id: relation, external: `wx-${relation}`, total: 210, wechat: 210 });
    await database.query(
      `insert into finance.journal(id,scope_id,reference_type,reference_id,currency,state,posted_at,${relation})
      values($1,'scope:finance',$2,$3,'CNY','posted','2026-08-28T04:01:00Z',$4)`,
      [`journal:${relation}:relation`, relation === 'reversal_of' ? 'finance.journal.reversal' : 'finance.journal.correction', `effect:${relation}`, `journal:payment:${relation}`]
    );
    await reconcile(database, relation, statement([[`wx-${relation}`, 'payment', 210]]));

    const item = await database.query<{ state: string; reason: string; eligible: boolean; relation: string }>(
      `select state,
      reason_code reason,(evidence->>'settlementEligible')::boolean eligible,
      evidence->'candidates'->0->>$2 relation from finance.reconciliationitem where reconciliation_id=$1`,
      [`reconciliation:${relation}`, evidenceKey]
    );
    expect(item.rows[0]).toEqual({ state: 'difference', reason, eligible: false, relation: `journal:${relation}:relation` });
  });

  it('fails closed instead of allocating one provider line across multiple payment allocations', async () => {
    await paymentFact(database, {
      id: 'multi-allocation',
      external: 'wx-multi-allocation',
      total: 100,
      wechat: 100,
      allocations: [
        ['order', 'order:multi-allocation', 40],
        ['suborder', 'suborder:multi-allocation', 60],
      ],
    });
    await reconcile(database, 'multi-allocation', statement([['wx-multi-allocation', 'payment', 100]]));
    const item = await database.query<{ id: string; state: string; reason: string; count: number; amount: number; version: number }>(`select id,state,reason_code reason,
      (evidence->'candidates'->0->>'allocationCount')::integer count,internal_minor::float8 amount
      ,version::float8 version
      from finance.reconciliationitem where reconciliation_id='reconciliation:multi-allocation'`);
    expect(item.rows[0]).toEqual(expect.objectContaining({ state: 'difference', reason: 'MANY_TO_ONE_UNSUPPORTED', count: 2, amount: 100, version: 0 }));
    const action = resolveDifferenceOperations()['finance.reconciliations.manage'];
    if (typeof action !== 'function') throw new Error('FINANCE_RESOLUTION_ACTION_MISSING');
    const request = {
      type: 'finance.reconciliations.manage',
      access: {
        scope: { id: 'scope:finance' },
        actor: { id: 'reviewer:one' },
        trace: 'trace:many-to-one',
      },
      input: {
        path: { reconciliationid: 'reconciliation:multi-allocation' },
        query: {},
        headers: {},
        body: { action: 'resolve', item: item.rows[0]!.id, itemVersion: item.rows[0]!.version, reason: 'manual allocation' },
        rawBody: '',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'resolve:many-to-one',
      },
    } as unknown as OperationRequest;
    await expect(action(request, database as unknown as OperationDatabase)).rejects.toThrow('RESOURCE_NOT_FOUND');
    const unchanged = await database.query<{ state: string }>('select state from finance.reconciliationitem where id=$1', [item.rows[0]!.id]);
    expect(unchanged.rows[0]?.state).toBe('difference');
  });

  it('detects an authoritative captured tender even when both its journal and provider statement line are missing', async () => {
    await paymentFact(database, { id: 'missing-journal', external: 'wx-missing-journal', total: 90, wechat: 90, journal: false });
    await reconcile(database, 'missing-journal', statement([]));

    const item = await database.query<{ statement: string | null; internal: number; difference: number; reason: string; journal: string | null }>(`select
      statement_line_id statement,internal_minor::float8 internal,difference_minor::float8 difference,reason_code reason,
      evidence->>'journal' journal from finance.reconciliationitem where reconciliation_id='reconciliation:missing-journal'`);
    expect(item.rows).toEqual([{ statement: null, internal: 90, difference: -90, reason: 'INTERNAL_JOURNAL_MISSING', journal: null }]);
    const parent = await database.query<{ state: string; debit: string; credit: string; difference: string }>(`select state,
      debit_minor::text debit,credit_minor::text credit,difference_minor::text difference
      from finance.reconciliation where id='reconciliation:missing-journal'`);
    expect(parent.rows[0]).toEqual({ state: 'difference', debit: '0', credit: '90', difference: '-90' });
  });

  it('preserves late capture/refund journal types as non-settleable reconciliation evidence', async () => {
    await paymentFact(database, { id: 'late', external: 'wx-late-payment', total: 420, wechat: 420, source: 'latewechat' });
    await refundFact(database, { id: 'late', payment: 'late', external: 'wx-late-refund', total: 420, wechat: 420, late: true });
    await reconcile(
      database,
      'late-cycle',
      statement([
        ['wx-late-payment', 'payment', 420],
        ['wx-late-refund', 'refund', 420],
      ])
    );

    const items = await database.query<{ kind: string; event: string; eligible: boolean; state: string }>(`select kind,
      evidence->>'journalReferenceType' event,(evidence->>'settlementEligible')::boolean eligible,state
      from finance.reconciliationitem where reconciliation_id='reconciliation:late-cycle' order by kind`);
    expect(items.rows).toEqual([
      { kind: 'payment', event: 'payment.late.detected', eligible: false, state: 'matched' },
      { kind: 'refund', event: 'payment.late.refunded', eligible: false, state: 'matched' },
    ]);
  });

  it('requires itemVersion, advances the parent version and enforces a different item approver', async () => {
    await reconcile(database, 'item-version', statement([['wx-item-version', 'payment', 70]]));
    const before = await database.query<{ id: string; version: number }>(`select id,version::float8 version
      from finance.reconciliationitem where reconciliation_id='reconciliation:item-version'`);
    const action = resolveDifferenceOperations()['finance.reconciliations.manage'];
    if (typeof action !== 'function') throw new Error('FINANCE_RESOLUTION_ACTION_MISSING');
    const item = before.rows[0]!;

    const proposed = await action(
      manageRequest('reconciliation:item-version', 'proposer:one', 1, {
        action: 'resolve',
        item: item.id,
        itemVersion: item.version,
        reason: 'Verified missing provider-side evidence',
      }),
      database as unknown as OperationDatabase
    );
    expect(proposed.headers?.etag).toBe('"2"');
    expect(proposed.body).toEqual(expect.objectContaining({ itemVersion: 1, version: 2, reconciliationState: 'difference' }));

    await expect(
      action(
        manageRequest('reconciliation:item-version', 'reviewer:one', 2, {
          action: 'approveitem',
          item: item.id,
          itemVersion: 0,
          reason: 'Stale review must fail',
        }),
        database as unknown as OperationDatabase
      )
    ).rejects.toThrow('RESOURCE_NOT_FOUND');
    await expect(
      action(
        manageRequest('reconciliation:item-version', 'proposer:one', 2, {
          action: 'approveitem',
          item: item.id,
          itemVersion: 1,
          reason: 'Self approval must fail',
        }),
        database as unknown as OperationDatabase
      )
    ).rejects.toThrow('RESOURCE_NOT_FOUND');

    const approved = await action(
      manageRequest('reconciliation:item-version', 'reviewer:one', 2, {
        action: 'approveitem',
        item: item.id,
        itemVersion: 1,
        reason: 'Independent evidence review complete',
      }),
      database as unknown as OperationDatabase
    );
    expect(approved.headers?.etag).toBe('"3"');
    expect(approved.body).toEqual(expect.objectContaining({ itemVersion: 2, version: 3, reconciliationState: 'resolved' }));
    const after = await database.query<{ item_state: string; item_version: number; parent_state: string; parent_version: number }>(
      `select
      item.state item_state,item.version::float8 item_version,reconciliation.state parent_state,
      reconciliation.version::float8 parent_version from finance.reconciliationitem item
      join finance.reconciliation reconciliation on reconciliation.id=item.reconciliation_id where item.id=$1`,
      [item.id]
    );
    expect(after.rows[0]).toEqual({ item_state: 'resolved', item_version: 2, parent_state: 'resolved', parent_version: 3 });

    await expect(
      action(
        manageRequest('reconciliation:item-version', 'reviewer:two', 3, {
          action: 'approve',
          reason: 'A resolved difference is not an authoritative match',
        }),
        database as unknown as OperationDatabase
      )
    ).rejects.toThrow('RESOURCE_NOT_FOUND');
    const settlementJobs = await database.query<{ count: number }>(`select count(*)::integer count from runtime.job where kind='settlement' and payload->>'reconciliation'='reconciliation:item-version'`);
    expect(settlementJobs.rows[0]?.count).toBe(0);
  });

  it('represents ambiguous provider references without selecting an arbitrary internal fact', async () => {
    await paymentFact(database, { id: 'refund-base-a', external: 'wx-payment-a', total: 100, wechat: 100 });
    await paymentFact(database, { id: 'refund-base-b', external: 'wx-payment-b', total: 100, wechat: 100 });
    await refundFact(database, { id: 'ambiguous-a', payment: 'refund-base-a', external: 'wx-refund-a', tenderReference: 'wx-shared-refund', total: 25, wechat: 25 });
    await refundFact(database, { id: 'ambiguous-b', payment: 'refund-base-b', external: 'wx-refund-b', tenderReference: 'wx-shared-refund', total: 35, wechat: 35 });
    await reconcile(database, 'ambiguous', statement([['wx-shared-refund', 'refund', 60]]));

    const items = await database.query<{ statement: string | null; internal: string | null; amount: number; reason: string }>(`select
      statement_line_id statement,internal_id internal,internal_minor::float8 amount,reason_code reason
      from finance.reconciliationitem where reconciliation_id='reconciliation:ambiguous' and kind='refund'
      order by statement_line_id nulls last,internal_id`);
    expect(items.rows).toHaveLength(3);
    expect(items.rows[0]).toEqual(expect.objectContaining({ statement: 'statementline:reconciliation:ambiguous:1', internal: null, amount: 0, reason: 'MANY_TO_ONE_UNSUPPORTED' }));
    expect(items.rows.slice(1)).toEqual([
      expect.objectContaining({ statement: null, internal: 'refund:ambiguous-a', amount: 25, reason: 'MANY_TO_ONE_UNSUPPORTED' }),
      expect.objectContaining({ statement: null, internal: 'refund:ambiguous-b', amount: 35, reason: 'MANY_TO_ONE_UNSUPPORTED' }),
    ]);
  });

  it('rejects an unsupported statement provider before mutating reconciliation state', async () => {
    await paymentFact(database, { id: 'provider-boundary', external: 'wx-provider-boundary', total: 80, wechat: 80 });
    await expect(reconcile(database, 'provider-boundary', statement([['wx-provider-boundary', 'payment', 80]]), 'supplier-channel')).rejects.toThrow('FINANCE_RECONCILIATION_PROVIDER_UNSUPPORTED');
    const unchanged = await database.query<{ state: string }>(`select state from finance.reconciliation
      where id='reconciliation:provider-boundary'`);
    expect(unchanged.rows[0]?.state).toBe('received');
  });

  it.each(['fee', 'adjustment', 'fulfillment'])('rejects unsupported %s lines in both parser and database', async (kind) => {
    const csv = statement([['unsupported-reference', kind, 10]]);
    await expect(reconcile(database, `unsupported-${kind}`, csv)).rejects.toThrow('STATEMENT_TYPE_INVALID');
    await expect(
      database.query(
        `insert into finance.statementline(id,reconciliation_id,scope_id,sequence,external_reference,kind,
      amount_minor,tax_minor,currency,raw_hash) values($1,$2,'scope:finance',1,'unsupported-reference',$3,10,0,'CNY',$4)`,
        [`statementline:unsupported:${kind}`, `reconciliation:unsupported-${kind}`, kind, 'a'.repeat(64)]
      )
    ).rejects.toThrow(/statementline_kind_check|check constraint/i);
  });

  it.each([
    ['non-canonical amount', 'wx-invalid,payment,1e3,0,CNY,2026-08-28T12:00:00+08:00', 'STATEMENT_AMOUNT_INVALID'],
    ['unsafe tax', 'wx-invalid,payment,10,9007199254740992,CNY,2026-08-28T12:00:00+08:00', 'STATEMENT_TAX_INVALID'],
    ['outside period', 'wx-invalid,payment,10,0,CNY,2026-08-29T00:00:00+08:00', 'STATEMENT_OCCURRED_AT_OUTSIDE_PERIOD'],
  ])('rejects %s before a statement line can become accounting evidence', async (_name, row, code) => {
    const csv = new TextEncoder().encode(`reference,type,amountMinor,taxMinor,currency,occurredAt\n${row}`);
    await expect(reconcile(database, `invalid-${code}`, csv)).rejects.toThrow(code);
    const stored = await database.query<{ count: number }>(
      `select count(*)::integer count from finance.statementline
      where reconciliation_id=$1`,
      [`reconciliation:invalid-${code}`]
    );
    expect(stored.rows[0]?.count).toBe(0);
  });
});

async function reconcile(database: PGlite, key: string, bytes: Uint8Array, provider = 'wechat'): Promise<void> {
  const id = `reconciliation:${key}`;
  const existing = await database.query<{ found: boolean }>('select exists(select 1 from finance.reconciliation where id=$1) found', [id]);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (!existing.rows[0]?.found) {
    await database.query(
      `insert into channel.statement(id,provider,scope_id,partner_id,period_start,period_end,timezone,object_ref,sha256)
      values($1,$2,'scope:finance','partner:finance',$3,$4,$5,$6,$7)`,
      [`statement:${key}`, provider, period.start, period.end, period.timezone, `object:${key}`, hash]
    );
    await database.query(
      `insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,
      created_by,evidence) values($1,'scope:finance',$2,'partner:finance',$3,$4,$5,'received','tester','{}')`,
      [id, provider, `${period.start}/${period.end}`, `statement:${key}`, hash]
    );
  }
  await new ReconcileStatement(pool(database), objects(bytes)).execute(id);
}

async function paymentFact(
  database: PGlite,
  input: Readonly<{
    id: string;
    external: string;
    total: number;
    wechat: number;
    allocations?: readonly (readonly [string, string, number])[];
    journal?: boolean;
    source?: 'wechat' | 'mixed' | 'latewechat';
  }>
): Promise<void> {
  const intent = `intent:${input.id}`;
  const payment = `payment:${input.id}`;
  const order = `order:${input.id}`;
  await database.query(`insert into ordering.orderrecord(id,scope_id) values($1,'scope:finance')`, [order]);
  await database.query(`insert into payment.intent(id,order_id,currency,provider_reference) values($1,$2,'CNY',$3)`, [intent, order, `out-trade:${input.id}`]);
  await database.query(`insert into payment.payment(id,intent_id,amount_minor,currency) values($1,$2,$3,'CNY')`, [payment, intent, input.total]);
  await database.query(
    `insert into payment.intenttender(intent_id,sequence,kind,amount_minor,state)
    values($1,1,'wechat',$2,'captured')`,
    [intent, input.wechat]
  );
  await database.query(
    `insert into payment.attempt(id,intent_id,provider,external_transaction,state,completed_at)
    values($1,$2,'wechat',$3,'succeeded','2026-08-28T04:00:00Z')`,
    [`attempt:${input.id}`, intent, input.external]
  );
  await database.query(
    `insert into payment.capture(id,scope_id,order_id,source,currency,amount_minor,state,completed_at)
    values($1,'scope:finance',$2,$3,'CNY',$4,'succeeded','2026-08-28T04:00:00Z')`,
    [`capture:${input.id}`, order, input.source ?? (input.total === input.wechat ? 'wechat' : 'mixed'), input.total]
  );
  if (input.total > input.wechat)
    await database.query(
      `insert into payment.intenttender(intent_id,sequence,kind,amount_minor,state)
    values($1,2,'benefit',$2,'captured')`,
      [intent, input.total - input.wechat]
    );
  const allocations = input.allocations ?? [['order', order, input.total] as const];
  for (const [type, target, amount] of allocations)
    await database.query(
      `insert into payment.allocation(payment_id,target_type,target_id,amount_minor,currency)
    values($1,$2,$3,$4,'CNY')`,
      [payment, type, target, amount]
    );
  if (input.journal !== false) {
    await journal(database, `journal:payment:${input.id}`, input.source === 'latewechat' ? 'payment.late.detected' : 'payment.succeeded', payment, input.wechat);
  }
}

async function refundFact(database: PGlite, input: Readonly<{ id: string; payment: string; external: string; tenderReference?: string; total: number; wechat: number; late?: boolean }>): Promise<void> {
  const refund = `refund:${input.id}`;
  await database.query(
    `insert into payment.refund(id,payment_id,provider,provider_reference,external_transaction,amount_minor,currency,state,reason)
    values($1,$2,'mixed',$3,$4,$5,'CNY','succeeded',$6)`,
    [refund, `payment:${input.payment}`, `out-refund:${input.id}`, input.external, input.total, input.late ? 'latepayment' : 'requested']
  );
  await database.query(
    `insert into payment.refundtender(refund_id,sequence,kind,amount_minor,state,provider_reference)
    values($1,1,'wechat',$2,'succeeded',$3)`,
    [refund, input.wechat, input.tenderReference ?? input.external]
  );
  if (input.total > input.wechat)
    await database.query(
      `insert into payment.refundtender(refund_id,sequence,kind,amount_minor,state)
    values($1,2,'benefit',$2,'succeeded')`,
      [refund, input.total - input.wechat]
    );
  await database.query(
    `insert into payment.providerattempt(id,refund_id,outcome,provider_state,provider_reference,completed_at)
    values($1,$2,'succeeded','succeeded',$3,'2026-08-28T04:05:00Z')`,
    [`providerattempt:${input.id}`, refund, input.external]
  );
  await journal(database, `journal:refund:${input.id}`, input.late ? 'payment.late.refunded' : 'payment.refunded', refund, input.wechat);
}

async function journal(database: PGlite, id: string, type: string, reference: string, amount: number): Promise<void> {
  await database.query(
    `insert into finance.journal(id,scope_id,reference_type,reference_id,currency,state,posted_at)
    values($1,'scope:finance',$2,$3,'CNY','posted','2026-08-28T04:00:00Z')`,
    [id, type, reference]
  );
  await database.query(`insert into finance.entry(id,journal_id,side,amount_minor) values($1,$3,'debit',$4),($2,$3,'credit',$4)`, [`entry:${id}:debit`, `entry:${id}:credit`, id, amount]);
}

function statement(rows: readonly (readonly [string, string, number])[]): Uint8Array {
  return new TextEncoder().encode(['reference,type,amountMinor,taxMinor,currency,occurredAt', ...rows.map(([reference, kind, amount]) => `${reference},${kind},${amount},0,CNY,2026-08-28T12:00:00+08:00`)].join('\n'));
}

function pool(database: PGlite): DatabasePool {
  const query = (text: string, values?: readonly unknown[]) => database.query(text, values === undefined ? undefined : [...values]);
  const adapter = { query, connect: async () => ({ query, release: () => undefined }), workload: () => adapter, end: async () => database.close() };
  return adapter as unknown as DatabasePool;
}

function objects(bytes: Uint8Array): ObjectStore {
  return { read: async () => bytes } as unknown as ObjectStore;
}

function manageRequest(reconciliation: string, actor: string, expectedVersion: number, body: Readonly<Record<string, unknown>>): OperationRequest {
  return {
    type: 'finance.reconciliations.manage',
    access: {
      scope: { id: 'scope:finance' },
      actor: { id: actor },
      trace: `trace:${actor}`,
    },
    input: { path: { reconciliationid: reconciliation }, query: {}, headers: {}, body, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: `manage:${actor}:${expectedVersion}`, expectedVersion },
  } as unknown as OperationRequest;
}

const baseSchema = `
  create schema finance; create schema channel; create schema payment; create schema ordering; create schema runtime;
  create table runtime.schemaversion(version text primary key,checksum char(64) not null);
  create table channel.statement(id text primary key,provider text not null,scope_id text not null,partner_id text not null,
    period_start date not null,period_end date not null,timezone text not null,object_ref text not null,sha256 char(64) not null);
  create table finance.reconciliation(id text primary key,scope_id text not null,provider text not null,partner_id text not null,
    period text not null,statement_ref text not null references channel.statement(id),statement_hash char(64) not null,
    state text not null check(state in('received','matching','balanced','difference','resolved','approved')),debit_minor bigint not null default 0,
    credit_minor bigint not null default 0,difference_minor bigint not null default 0,created_by text not null,approved_by text,
    evidence jsonb not null default '{}',updated_at timestamptz not null default clock_timestamp(),version bigint not null default 0);
  create table finance.statementline(id text primary key,reconciliation_id text not null references finance.reconciliation(id),scope_id text not null,
    sequence integer not null,external_reference text not null,kind text not null check(kind in('payment','refund','fulfillment','fee','adjustment')),
    amount_minor bigint not null,tax_minor bigint not null,currency char(3) not null,occurred_at timestamptz,raw_hash char(64) not null,
    unique(reconciliation_id,sequence),unique(reconciliation_id,external_reference,kind));
  create table finance.reconciliationitem(id text primary key,reconciliation_id text not null references finance.reconciliation(id),
    statement_line_id text not null unique references finance.statementline(id),scope_id text not null,internal_type text,internal_id text,
    external_minor bigint not null,internal_minor bigint not null,difference_minor bigint not null,state text not null
    check(state in('matched','difference','resolutionpending','resolved')),reason_code text,evidence jsonb not null,resolution jsonb,
    resolved_by text,approved_by text,resolved_at timestamptz,approved_at timestamptz,version bigint not null default 0);
  create table ordering.orderrecord(id text primary key,scope_id text not null);
  create table payment.intent(id text primary key,order_id text not null references ordering.orderrecord(id),currency char(3) not null,
    provider_reference text not null);
  create table payment.payment(id text primary key,intent_id text not null references payment.intent(id),amount_minor bigint not null,
    currency char(3) not null,state text not null default 'captured');
  create table payment.intenttender(intent_id text not null references payment.intent(id),sequence integer not null,kind text not null,
    amount_minor bigint not null,state text not null,primary key(intent_id,sequence));
  create table payment.attempt(id text primary key,intent_id text not null references payment.intent(id),provider text not null,
    external_transaction text,state text not null,completed_at timestamptz,unique(provider,external_transaction));
  create table payment.capture(id text primary key,scope_id text not null,order_id text not null,source text not null,
    currency char(3) not null,amount_minor bigint not null,state text not null,completed_at timestamptz not null);
  create table payment.allocation(payment_id text not null references payment.payment(id),target_type text not null,target_id text not null,
    amount_minor bigint not null,currency char(3) not null,primary key(payment_id,target_type,target_id));
  create table payment.refund(id text primary key,payment_id text not null references payment.payment(id),provider text not null,
    provider_reference text not null unique,external_transaction text,amount_minor bigint not null,currency char(3) not null,state text not null,
    reason text not null,unique(provider,external_transaction));
  create table payment.refundtender(refund_id text not null references payment.refund(id),sequence integer not null,kind text not null,
    amount_minor bigint not null,state text not null,provider_reference text,primary key(refund_id,sequence));
  create table payment.providerattempt(id text primary key,refund_id text not null,outcome text not null,provider_state text,
    provider_reference text,completed_at timestamptz);
  create table finance.journal(id text primary key,scope_id text not null,reference_type text not null,reference_id text not null,
    currency char(3) not null,state text not null,posted_at timestamptz not null,reversal_of text references finance.journal(id),
    correction_of text references finance.journal(id));
  create table finance.entry(id text primary key,journal_id text not null references finance.journal(id),side text not null,amount_minor bigint not null);
  create table runtime.outbox(id text primary key,event_type text not null,event_version integer not null,aggregate_type text not null,
    aggregate_id text not null,scope_id text not null,payload jsonb not null,trace_id text not null,occurred_at timestamptz not null,
    available_at timestamptz not null);
  create table runtime.job(id text primary key,kind text not null,owner text not null,scope_id text not null,payload jsonb not null,
    state text not null,priority integer not null,attempts integer not null default 0,available_at timestamptz not null,
    created_at timestamptz not null,updated_at timestamptz not null);
`;
