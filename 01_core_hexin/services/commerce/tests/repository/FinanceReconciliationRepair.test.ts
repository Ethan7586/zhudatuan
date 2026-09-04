import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrations = fileURLToPath(new URL('../../../../../02_platform_pingtai/database/supabase/migrations', import.meta.url));
const proposer = Object.freeze({
  actor: 'member-fresh-replay-ethan',
  membership: 'membership-platform-owner-ethan-v1',
  session: 'session:repair:proposer',
  assurance: 'assurance:repair:proposer',
});
const reviewer = Object.freeze({
  actor: 'principal:repair:reviewer',
  membership: 'membership:repair:reviewer',
  session: 'session:repair:reviewer',
  assurance: 'assurance:repair:reviewer',
});
const period = '2026-08';
const occurredAt = '2026-08-28T04:00:00.000000Z';

describe('authoritative reconciliation repair PostgreSQL workflow', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await replayThroughRepair(database);
    await seedReviewerAndProofSessions(database);
    for (const [key, state] of [
      ['core', 'open'],
      ['missing-proof', 'open'],
      ['hash-binding', 'open'],
      ['self-review', 'open'],
      ['stale', 'open'],
      ['closed', 'closed'],
      ['downstream', 'open'],
    ] as const) {
      await seedCandidate(database, key, state);
    }
    for (const [key, staleEvidence] of [
      ['refund-preview', false],
      ['refund-stale', true],
    ] as const) {
      await seedCandidate(database, key, 'open');
      await seedRefundCandidate(database, key, staleEvidence);
    }
  }, 60_000);

  afterAll(async () => database.close());

  it('executes preview, proof-bound submit, four-eyes posting, authoritative read and exact reverse replay', async () => {
    const preview = await previewRepair(database, 'core', proposer, 'preview:core');
    expect(preview.repair).toEqual(expect.objectContaining({ state: 'preview', version: 0, proposedBy: proposer.actor }));
    expect(preview.lines).toEqual([
      expect.objectContaining({ sequence: 1, side: 'debit', accountCode: 'channel.clearing.wechat', amountMinor: 100 }),
      expect.objectContaining({ sequence: 2, side: 'credit', accountCode: 'order.receivable.order:repair:core', amountMinor: 100 }),
    ]);

    const repair = text(preview.repair, 'id');
    const previewHash = text(preview.repair, 'previewHash');
    const submitted = await submitRepair(database, repair, scope('core'), proposer, 'submit:core', 0, previewHash);
    expect(submitted.repair).toEqual(expect.objectContaining({ state: 'submitted', version: 1, submittedBy: proposer.actor }));
    const executed = await decideRepair(database, repair, scope('core'), reviewer, 'decide:core', 1, 'approve');
    expect(executed.repair).toEqual(expect.objectContaining({ state: 'executed', version: 2, approvedBy: reviewer.actor }));
    expect(executed.effects).toEqual([expect.objectContaining({ kind: 'execute', actorId: reviewer.actor })]);

    const read = await asApp<Record<string, unknown>>(database, reviewer, scope('core'), `select finance.read_reconciliation_repair($1,$2) receipt`, [repair, scope('core')]);
    expect(read).toEqual(executed);
    const reversed = await reverseRepair(database, repair, scope('core'), reviewer, 'reverse:core', 2);
    expect(reversed.repair).toEqual(expect.objectContaining({ state: 'reversed', version: 3, reversedBy: reviewer.actor }));
    expect(reversed.effects).toEqual([expect.objectContaining({ kind: 'execute' }), expect.objectContaining({ kind: 'reverse', actorId: reviewer.actor })]);

    await expect(previewRepair(database, 'core', proposer, 'preview:core')).resolves.toEqual(reversed);
    await expect(
      asApp<Record<string, unknown>>(database, proposer, scope('core'), `select finance.submit_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`, [repair, scope('core'), proposer.actor, 'submit:core', 0, previewHash, proofRequestHash('finance.reconciliationrepairs.submit', repair, 'submit:core', 0)])
    ).resolves.toEqual(reversed);
    await expect(
      asApp<Record<string, unknown>>(database, reviewer, scope('core'), `select finance.decide_reconciliation_repair($1,$2,$3,$4,$5,'approve',$6,$7::jsonb,$8) receipt`, [
        repair,
        scope('core'),
        reviewer.actor,
        'decide:core',
        1,
        'independent authoritative review',
        JSON.stringify({ ticket: repair.replace('repair:', 'FIN-') }),
        proofRequestHash('finance.reconciliationrepairs.decide', repair, 'decide:core', 1),
      ])
    ).resolves.toEqual(reversed);
    await expect(
      asApp<Record<string, unknown>>(database, reviewer, scope('core'), `select finance.reverse_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`, [repair, scope('core'), reviewer.actor, 'reverse:core', 2, 'authoritative source withdrawn', proofRequestHash('finance.reconciliationrepairs.reverse', repair, 'reverse:core', 2)])
    ).resolves.toEqual(reversed);
  }, 20_000);

  it('fails closed for stale versions, wrong preview hash, missing proof, self approval, cross-scope reads and a closed period', async () => {
    await expect(previewRepair(database, 'stale', proposer, 'preview:stale-version', 7, 0)).rejects.toThrow('VERSION_CONFLICT');
    await expect(previewRepair(database, 'stale', proposer, 'preview:stale-item', 0, 7)).rejects.toThrow('VERSION_CONFLICT');
    const stale = await previewRepair(database, 'stale', proposer, 'preview:stale');
    await expect(
      asApp(database, proposer, scope('stale'), `select finance.submit_reconciliation_repair($1,$2,$3,$4,0,$5,$6) receipt`, [text(stale.repair, 'id'), scope('stale'), proposer.actor, 'submit:wrong-hash', 'f'.repeat(64), proofRequestHash('finance.reconciliationrepairs.submit', text(stale.repair, 'id'), 'submit:wrong-hash', 0)])
    ).rejects.toThrow('VERSION_CONFLICT');

    const missing = await previewRepair(database, 'missing-proof', proposer, 'preview:missing-proof');
    await expect(
      asApp(database, proposer, scope('missing-proof'), `select finance.submit_reconciliation_repair($1,$2,$3,$4,0,$5,$6) receipt`, [
        text(missing.repair, 'id'),
        scope('missing-proof'),
        proposer.actor,
        'submit:missing-proof',
        text(missing.repair, 'previewHash'),
        proofRequestHash('finance.reconciliationrepairs.submit', text(missing.repair, 'id'), 'submit:missing-proof', 0),
      ])
    ).rejects.toThrow('ACTION_PROOF_REQUIRED');

    const self = await previewRepair(database, 'self-review', proposer, 'preview:self');
    const selfRepair = text(self.repair, 'id');
    await submitRepair(database, selfRepair, scope('self-review'), proposer, 'submit:self', 0, text(self.repair, 'previewHash'));
    await expect(decideRepair(database, selfRepair, scope('self-review'), proposer, 'decide:self', 1, 'approve')).rejects.toThrow('FINANCE_REPAIR_FOUR_EYES_REQUIRED');

    await expect(asApp(database, reviewer, scope('stale'), `select finance.read_reconciliation_repair($1,$2) receipt`, [text(stale.repair, 'id'), scope('core')])).rejects.toThrow('FINANCE_REPAIR_SCOPE_FORBIDDEN');
    await expect(previewRepair(database, 'closed', proposer, 'preview:closed')).rejects.toThrow('FINANCE_PERIOD_NOT_OPEN');
  }, 20_000);

  it('binds submit, decide and reverse execution to the exact proof request hash', async () => {
    const preview = await previewRepair(database, 'hash-binding', proposer, 'preview:hash-binding');
    const repair = text(preview.repair, 'id');
    const wrongHash = 'f'.repeat(64);

    await expect(proofCall(
      database, proposer, scope('hash-binding'), 'finance.reconciliationrepairs.submit', repair,
      'submit:hash-mismatch', 0, `select finance.submit_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`,
      [repair, scope('hash-binding'), proposer.actor, 'submit:hash-mismatch', 0, text(preview.repair, 'previewHash')], wrongHash
    )).rejects.toThrow('ACTION_PROOF_REQUIRED');
    await submitRepair(database, repair, scope('hash-binding'), proposer, 'submit:hash-correct', 0, text(preview.repair, 'previewHash'));

    await expect(proofCall(
      database, reviewer, scope('hash-binding'), 'finance.reconciliationrepairs.decide', repair,
      'decide:hash-mismatch', 1, `select finance.decide_reconciliation_repair($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) receipt`,
      [repair, scope('hash-binding'), reviewer.actor, 'decide:hash-mismatch', 1, 'approve', 'independent authoritative review', '{}'], wrongHash
    )).rejects.toThrow('ACTION_PROOF_REQUIRED');
    await decideRepair(database, repair, scope('hash-binding'), reviewer, 'decide:hash-correct', 1, 'approve');

    await expect(proofCall(
      database, reviewer, scope('hash-binding'), 'finance.reconciliationrepairs.reverse', repair,
      'reverse:hash-mismatch', 2, `select finance.reverse_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`,
      [repair, scope('hash-binding'), reviewer.actor, 'reverse:hash-mismatch', 2, 'authoritative source withdrawn'], wrongHash
    )).rejects.toThrow('ACTION_PROOF_REQUIRED');
    await expect(reverseRepair(database, repair, scope('hash-binding'), reviewer, 'reverse:hash-correct', 2)).resolves.toEqual(
      expect.objectContaining({ repair: expect.objectContaining({ state: 'reversed', version: 3 }) })
    );
  }, 20_000);

  it('default-denies raw access to every new repair table for shopapp', async () => {
    const statements = [
      `update finance.reconciliationrepair set updated_at=updated_at`,
      `insert into finance.reconciliationrepairline(repair_id,sequence,side,account_code,account_kind,amount_minor,currency)
        values('none',1,'debit','none','asset',1,'CNY')`,
      `delete from finance.reconciliationrepaireffect`,
      `select * from finance.reconciliationrepairauthorization`,
      `insert into access.repairactionauthorization(transaction_id,actor_id,scope_id,operation,resource_id,
        idempotency_key,expected_version,request_hash) values(1,'x','x','finance.reconciliationrepairs.submit','x','x',0,repeat('a',64))`,
    ];
    for (const statement of statements) {
      await expect(asApp(database, proposer, scope('core'), statement)).rejects.toThrow(/permission denied|row-level security/i);
    }
  });

  it('previews an authoritative partial refund plan and rejects stale sealed provider evidence', async () => {
    const preview = await previewRepair(database, 'refund-preview', proposer, 'preview:refund');
    expect(preview.repair).toEqual(
      expect.objectContaining({
        state: 'preview',
        sourceHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        targetHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    );
    expect(preview.lines).toEqual([
      expect.objectContaining({
        sequence: 1,
        side: 'debit',
        accountCode: 'commerce.refund',
        accountKind: 'expense',
        amountMinor: 40,
      }),
      expect.objectContaining({
        sequence: 2,
        side: 'credit',
        accountCode: 'channel.clearing.wechat',
        accountKind: 'asset',
        amountMinor: 40,
      }),
    ]);
    const evidence = await database.query<{
      amount_minor: number;
      total_minor: number;
      refund_hash_valid: boolean;
      capture_hash_valid: boolean;
    }>(`select
      (refund.provider_effect->>'amountMinor')::integer amount_minor,
      (refund.provider_effect->>'totalMinor')::integer total_minor,
      refund.provider_effect_hash=encode(public.digest(refund.provider_effect::text,'sha256'),'hex') refund_hash_valid,
      capture.provider_effect_hash=encode(public.digest(capture.provider_effect::text,'sha256'),'hex') capture_hash_valid
      from payment.providerattempt refund
      join payment.refund request on request.id=refund.refund_id
      join payment.payment payment on payment.id=request.payment_id
      join payment.intent intent on intent.id=payment.intent_id
      join payment.capture capture on capture.id='capture:'||intent.id
      where refund.refund_id='refund:repair:refund-preview'`);
    expect(evidence.rows[0]).toEqual({
      amount_minor: 40,
      total_minor: 100,
      refund_hash_valid: true,
      capture_hash_valid: true,
    });
    await expect(previewRepair(database, 'refund-stale', proposer, 'preview:refund-stale')).rejects.toThrow('FINANCE_REPAIR_REFUND_FACT_STALE');
  }, 20_000);

  it('refuses reversal after reconciliation approval or a settlement snapshot exists', async () => {
    const preview = await previewRepair(database, 'downstream', proposer, 'preview:downstream');
    const repair = text(preview.repair, 'id');
    await submitRepair(database, repair, scope('downstream'), proposer, 'submit:downstream', 0, text(preview.repair, 'previewHash'));
    await decideRepair(database, repair, scope('downstream'), reviewer, 'decide:downstream', 1, 'approve');
    await database.exec(`update finance.reconciliation set state='approved',approved_by='${reviewer.actor}'
      where id='reconciliation:repair:downstream';
      insert into finance.settlement(id,partner_id,period,reconciliation_id,amount_minor,currency,state,scope_id,
        requested_by,frozen_at,evidence,version,gross_minor,fee_minor,invoice_basis)
      values('settlement:repair:downstream','partner:repair:downstream','2026-08-01/2026-08-31',
        'reconciliation:repair:downstream',100,'CNY','draft','${scope('downstream')}',
        '${proposer.actor}',clock_timestamp(),'{}',0,100,0,'gross')`);
    await expect(reverseRepair(database, repair, scope('downstream'), reviewer, 'reverse:downstream', 2)).rejects.toThrow('FINANCE_REPAIR_DOWNSTREAM_LOCKED');
    const unchanged = await database.query<{ repair: string; reconciliation: string; reversals: number }>(
      `select
      (select state from finance.reconciliationrepair where id=$1) repair,
      (select state from finance.reconciliation where id='reconciliation:repair:downstream') reconciliation,
      (select count(*)::integer from finance.reconciliationrepaireffect where repair_id=$1 and kind='reverse') reversals`,
      [repair]
    );
    expect(unchanged.rows[0]).toEqual({ repair: 'executed', reconciliation: 'approved', reversals: 0 });
  }, 20_000);
});

async function previewRepair(database: PGlite, key: string, actor: Actor, idempotency: string, reconciliationVersion = 0, itemVersion = 0): Promise<Record<string, unknown>> {
  return asApp(
    database,
    actor,
    scope(key),
    `select finance.preview_reconciliation_repair($1,$2,$3,$4,$5,$6,$7,
      'INTERNAL_JOURNAL_MISSING',$8::jsonb) receipt`,
    [`reconciliation:repair:${key}`, `item:repair:${key}`, scope(key), actor.actor, idempotency, reconciliationVersion, itemVersion, JSON.stringify({ ticket: `FIN-${key}` })]
  );
}

async function submitRepair(database: PGlite, repair: string, targetScope: string, actor: Actor, idempotency: string, expectedVersion: number, previewHash: string): Promise<Record<string, unknown>> {
  return proofCall(database, actor, targetScope, 'finance.reconciliationrepairs.submit', repair, idempotency, expectedVersion, `select finance.submit_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`, [
    repair,
    targetScope,
    actor.actor,
    idempotency,
    expectedVersion,
    previewHash,
  ]);
}

async function decideRepair(database: PGlite, repair: string, targetScope: string, actor: Actor, idempotency: string, expectedVersion: number, decision: 'approve' | 'reject'): Promise<Record<string, unknown>> {
  return proofCall(database, actor, targetScope, 'finance.reconciliationrepairs.decide', repair, idempotency, expectedVersion, `select finance.decide_reconciliation_repair($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) receipt`, [
    repair,
    targetScope,
    actor.actor,
    idempotency,
    expectedVersion,
    decision,
    'independent authoritative review',
    JSON.stringify({ ticket: repair.replace('repair:', 'FIN-') }),
  ]);
}

async function reverseRepair(database: PGlite, repair: string, targetScope: string, actor: Actor, idempotency: string, expectedVersion: number): Promise<Record<string, unknown>> {
  return proofCall(database, actor, targetScope, 'finance.reconciliationrepairs.reverse', repair, idempotency, expectedVersion, `select finance.reverse_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`, [
    repair,
    targetScope,
    actor.actor,
    idempotency,
    expectedVersion,
    'authoritative source withdrawn',
  ]);
}

async function proofCall(
  database: PGlite,
  actor: Actor,
  targetScope: string,
  operation: string,
  resource: string,
  idempotency: string,
  expectedVersion: number,
  statement: string,
  values: readonly unknown[],
  functionRequestHash?: string
): Promise<Record<string, unknown>> {
  const proof = digest(`proof:${operation}:${resource}:${idempotency}`);
  const requestHash = proofRequestHash(operation, resource, idempotency, expectedVersion);
  await database.query(`select * from access.issue_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [proof, actor.actor, actor.session, actor.membership, actor.assurance, operation, resource, idempotency, expectedVersion, requestHash]);
  return inAppTransaction(database, actor, targetScope, async () => {
    const consumed = await database.query<{ accepted: boolean }>(`select access.consume_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) accepted`, [
      proof,
      actor.actor,
      actor.session,
      actor.membership,
      targetScope,
      operation,
      resource,
      idempotency,
      expectedVersion,
      requestHash,
    ]);
    if (consumed.rows[0]?.accepted !== true) throw new Error('TEST_ACTION_PROOF_NOT_CONSUMED');
    const result = await database.query<{ receipt: Record<string, unknown> }>(statement, [...values, functionRequestHash ?? requestHash]);
    return result.rows[0]!.receipt;
  });
}

function proofRequestHash(operation: string, resource: string, idempotency: string, expectedVersion: number): string {
  return digest(`request:${operation}:${resource}:${idempotency}:${expectedVersion}`);
}

async function asApp<T = unknown>(database: PGlite, actor: Actor, targetScope: string, statement: string, values: readonly unknown[] = []): Promise<T> {
  return inAppTransaction(database, actor, targetScope, async () => {
    const result = await database.query<{ receipt: T }>(statement, [...values]);
    return result.rows[0]?.receipt as T;
  });
}

async function inAppTransaction<T>(database: PGlite, actor: Actor, targetScope: string, action: () => Promise<T>): Promise<T> {
  await database.exec('begin');
  try {
    await database.query(
      `select set_config('app.scope_id',$1,true),set_config('app.actor_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.workload','api',true)`,
      [targetScope, actor.actor, actor.membership]
    );
    await database.exec('set local role shopapp');
    const result = await action();
    await database.exec('commit');
    return result;
  } catch (cause) {
    await database.exec('rollback');
    throw cause;
  }
}

async function seedCandidate(database: PGlite, key: string, periodState: 'open' | 'closed'): Promise<void> {
  const targetScope = scope(key);
  const amount = 100;
  const order = `order:repair:${key}`;
  const intent = `intent:repair:${key}`;
  const payment = `payment:repair:${key}`;
  const reference = `wechat:repair:${key}`;
  const effect = JSON.stringify({
    version: 1,
    provider: 'wechat',
    kind: 'payment.capture',
    intent,
    order,
    transaction: reference,
    providerAmountMinor: amount,
    aggregateAmountMinor: amount,
    currency: 'CNY',
    occurredAt,
  });
  await database.query(
    `insert into ordering.orderrecord(
    id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
    fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,
    address_snapshot,invoice_snapshot,delivery_snapshot
  ) values($1,$2,$3,$4,'mall-demo',$5,'CNY',$6,'paid','unallocated','none','active','{}',$7,$7,'null','null','{}')`,
    [order, `REPAIR-${key}`, targetScope, proposer.actor, `checkout:repair:${key}`, amount, occurredAt]
  );
  await database.query(
    `insert into payment.intent(id,order_id,member_id,currency,amount_minor,state,idempotency_key,
    provider_reference,expires_at,version) values($1,$2,$3,'CNY',$4,'captured',$5,$6,$7::timestamptz+interval '1 day',0)`,
    [intent, order, proposer.actor, amount, `idempotency:repair:${key}`, reference, occurredAt]
  );
  await database.query(
    `insert into payment.payment(id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
    values($1,$2,$3,'CNY',$3,0,'captured',0)`,
    [payment, intent, amount]
  );
  await database.query(
    `insert into payment.intenttender(intent_id,sequence,kind,amount_minor,state)
    values($1,1,'wechat',$2,'captured')`,
    [intent, amount]
  );
  await database.query(
    `insert into payment.attempt(id,intent_id,tender_id,provider,external_transaction,state,
    requested_at,completed_at,provider_occurred_at,provider_effect,provider_effect_hash)
    values($1,$2,'tender:wechat','wechat',$3,'succeeded',$4::timestamptz-interval '1 minute',$4,$4,$5::jsonb,
      encode(public.digest($5::jsonb::text,'sha256'),'hex'))`,
    [`attempt:repair:${key}`, intent, reference, occurredAt, effect]
  );
  await database.query(
    `insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,
    amount_minor,state,idempotency_key,completed_at,created_at,provider_occurred_at,provider_effect,provider_effect_hash)
    values($1,$2,'mall-demo',$3,$4,'wechat','CNY',$5,'succeeded',$6,$7,$7,$7,$8::jsonb,
      encode(public.digest($8::jsonb::text,'sha256'),'hex'))`,
    [`capture:${intent}`, targetScope, proposer.actor, order, amount, `idempotency:repair:${key}`, occurredAt, effect]
  );
  await database.query(
    `insert into payment.allocation(payment_id,target_type,target_id,amount_minor,currency)
    values($1,'order',$2,$3,'CNY')`,
    [payment, order, amount]
  );
  await database.query(
    `insert into channel.connection(
      id,provider,scope_id,status,contract_version,configuration,connection_timeout_ms,response_timeout_ms,
      total_deadline_ms,max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,region
    ) values($1,'wechat',$2,'enabled','test','{}',1000,2000,3000,1,1,1,1,100,'local')`,
    [`connection:repair:${key}`, targetScope]
  );
  await database.query(
    `insert into channel.statement(id,connection_id,provider,scope_id,partner_id,
    period_start,period_end,timezone,object_ref,sha256,generated_at)
    values($1,$2,'wechat',$3,$4,'2026-08-01','2026-08-31','Asia/Shanghai',$5,$6,$7)`,
    [`statement:repair:${key}`, `connection:repair:${key}`, targetScope, `partner:repair:${key}`, `object:repair:${key}`, digest(`statement:${key}`), occurredAt]
  );
  await database.query(
    `insert into finance.reconciliation(id,scope_id,provider,partner_id,period,
    statement_ref,statement_hash,state,debit_minor,credit_minor,difference_minor,created_by,evidence,updated_at,version)
    values($1,$2,'wechat',$3,'2026-08-01/2026-08-31',$4,$5,'difference',100,100,0,$6,'{}',$7,0)`,
    [`reconciliation:repair:${key}`, targetScope, `partner:repair:${key}`, `statement:repair:${key}`, digest(`statement:${key}`), proposer.actor, occurredAt]
  );
  await database.query(
    `insert into finance.statementline(id,reconciliation_id,scope_id,sequence,
    external_reference,kind,amount_minor,tax_minor,currency,occurred_at,raw_hash)
    values($1,$2,$3,1,$4,'payment',100,0,'CNY',$5,$6)`,
    [`statementline:repair:${key}`, `reconciliation:repair:${key}`, targetScope, reference, occurredAt, digest(`line:${key}`)]
  );
  await database.query(
    `insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,
    scope_id,internal_type,internal_id,external_minor,internal_minor,difference_minor,state,reason_code,evidence,version,kind)
    values($1,$2,$3,$4,'payment',$5,100,100,0,'difference','INTERNAL_JOURNAL_MISSING',
      '{"source":"provider_statement","settlementEligible":false}',0,'payment')`,
    [`item:repair:${key}`, `reconciliation:repair:${key}`, `statementline:repair:${key}`, targetScope, payment]
  );
  await database.query(
    `insert into finance.ledger(id,scope_id,code,name,currency,legal_timezone,state,version)
      values(finance.ledger_id($1,'CNY'),$1,'general','General ledger','CNY','Asia/Shanghai','active',0)
      on conflict(scope_id,code,currency) do nothing`,
    [targetScope]
  );
  await database.query(
    `insert into finance.period(scope_id,period,state,ledger_id,legal_timezone,
    period_start_at,period_end_at) values($1,$2,$3,finance.ledger_id($1,'CNY'),'Asia/Shanghai',
      '2026-07-31T16:00:00Z','2026-08-31T16:00:00Z')`,
    [targetScope, period, periodState]
  );
  await database.query(
    `with current_period as (
      select to_char(clock_timestamp() at time zone 'Asia/Shanghai','YYYY-MM') value
    )
    insert into finance.period(scope_id,period,state,ledger_id,legal_timezone,period_start_at,period_end_at)
    select $1,value,'open',finance.ledger_id($1,'CNY'),'Asia/Shanghai',
      to_date(value||'-01','YYYY-MM-DD')::timestamp at time zone 'Asia/Shanghai',
      (to_date(value||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone 'Asia/Shanghai'
    from current_period where value<>$2
    on conflict(scope_id,period) do nothing`,
    [targetScope, period]
  );
}

async function seedRefundCandidate(database: PGlite, key: string, staleEvidence: boolean): Promise<void> {
  const payment = `payment:repair:${key}`;
  const refund = `refund:repair:${key}`;
  const providerReference = `wechat-refund:repair:${key}`;
  const effect = JSON.stringify({
    version: 1,
    provider: 'wechat',
    kind: 'payment.refund',
    refund,
    payment: staleEvidence ? `payment:stale-evidence:${key}` : payment,
    reference: providerReference,
    amountMinor: 40,
    totalMinor: 100,
    currency: 'CNY',
    occurredAt,
  });
  await database.query(`update payment.payment set refunded_minor=40,state='partially_refunded',version=1 where id=$1`, [payment]);
  await database.query(
    `insert into payment.refund(id,payment_id,provider,provider_reference,external_transaction,
      idempotency_key,amount_minor,currency,state,reason,version)
    values($1,$2,'wechat',$3,$4,$5,40,'CNY','succeeded','provider-confirmed partial refund',1)`,
    [refund, payment, `refund-request:repair:${key}`, providerReference, `idempotency:refund:repair:${key}`]
  );
  await database.query(
    `insert into payment.refundtender(
      refund_id,sequence,kind,reference_id,amount_minor,state,provider_reference
    ) values($1,1,'wechat',null,40,'succeeded',$2)`,
    [refund, providerReference]
  );
  await database.query(
    `insert into payment.providerattempt(id,refund_id,sequence,operation,worker_id,outcome,
      provider_state,provider_reference,request_id,started_at,completed_at,provider_occurred_at,
      provider_effect,provider_effect_hash)
    values($1,$2,1,'apply','worker:repair:test','succeeded','succeeded',$3,$4,
      $5::timestamptz-interval '1 minute',$5,$5,$6::jsonb,
      encode(public.digest($6::jsonb::text,'sha256'),'hex'))`,
    [`providerattempt:repair:${key}`, refund, providerReference, `request:refund:repair:${key}`, occurredAt, effect]
  );
  await database.query(`update finance.reconciliation set debit_minor=40,credit_minor=40 where id=$1`, [`reconciliation:repair:${key}`]);
  await database.query(
    `update finance.statementline set external_reference=$2,kind='refund',amount_minor=40
    where id=$1`,
    [`statementline:repair:${key}`, providerReference]
  );
  await database.query(
    `update finance.reconciliationitem set internal_type='refund',internal_id=$2,
    external_minor=40,internal_minor=40,kind='refund' where id=$1`,
    [`item:repair:${key}`, refund]
  );
}

async function seedReviewerAndProofSessions(database: PGlite): Promise<void> {
  await database.exec(`insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
      values('${reviewer.actor}','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
      values('member:repair:reviewer','${reviewer.actor}','Repair Reviewer','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      select '${reviewer.membership}','member:repair:reviewer',organization_id,'operator','active',1,clock_timestamp()
      from access.membership where id='${proposer.membership}';
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
      select '${reviewer.membership}',role_id,clock_timestamp(),null,'${proposer.actor}'
      from access.membershiprole where membership_id='${proposer.membership}'
      on conflict do nothing;
    insert into access.role(id,scope_id,name,status,version)
      values('role:repair:reviewer','organization-platform-root','Reconciliation Repair Reviewer','active',0);
    insert into access.rolepermission(role_id,permission_id,effect)
      select 'role:repair:reviewer',id,'allow' from access.permission
      where code='finance.reconciliation.manage' and status='active';
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
      values('${proposer.membership}','role:repair:reviewer','1970-01-01T00:00:00Z',null,'${proposer.actor}'),
        ('${reviewer.membership}','role:repair:reviewer','1970-01-01T00:00:00Z',null,'${proposer.actor}');
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('${proposer.session}','${proposer.actor}','${proposer.membership}',repeat('1',64),
      (select credential_version from identity.principal where id='${proposer.actor}'),
      (select access_version from access.membership where id='${proposer.membership}'),'console',repeat('2',64),'test','proposer',3,
      clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
    ('${reviewer.session}','${reviewer.actor}','${reviewer.membership}',repeat('3',64),1,1,'console',repeat('4',64),
      'test','reviewer',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
    values('${proposer.assurance}','${proposer.actor}','${proposer.session}','otp',3,repeat('5',64),clock_timestamp(),clock_timestamp()+interval '30 minutes'),
      ('${reviewer.assurance}','${reviewer.actor}','${reviewer.session}','otp',3,repeat('6',64),clock_timestamp(),clock_timestamp()+interval '30 minutes')`);
}

async function replayThroughRepair(database: PGlite): Promise<void> {
  await database.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);`);
  const files = (await readdir(migrations)).filter((name) => name.endsWith('.sql') && name <= '20260828100000_finance_reconciliation_repair_workflow.sql').sort();
  for (const name of files) {
    if (name === '20260817191000_bootstrap_ethan_platform_owner.sql') await seedOwner(database);
    if (name === '20260821026000_backfill_domain_data.sql') await stageSecrets(database);
    try {
      await database.exec(await readFile(`${migrations}/${name}`, 'utf8'));
    } catch (cause) {
      throw new Error(`MIGRATION_REPLAY_FAILED:${name}`, { cause });
    }
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
  }
}

async function seedOwner(database: PGlite): Promise<void> {
  await database.exec(`insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN',
      'Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status)
    values('${proposer.actor}','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id)
    values('local_username','ethan','${proposer.actor}');`);
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

function scope(key: string): string {
  return `scope:finance:repair:${key}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function text(value: unknown, field: string): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`TEST_RECEIPT_${field.toUpperCase()}_MISSING`);
  const selected = Reflect.get(value, field);
  if (typeof selected !== 'string' || selected.length === 0) throw new Error(`TEST_RECEIPT_${field.toUpperCase()}_MISSING`);
  return selected;
}

type Actor = Readonly<{ actor: string; membership: string; session: string; assurance: string }>;
