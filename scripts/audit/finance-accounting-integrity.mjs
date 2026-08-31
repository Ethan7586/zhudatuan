const SCOPE = 'scope:finance-accounting-integrity-audit';
const CURRENCY = 'CNY';
const MAX_SAFE_MINOR = '9007199254740991';
const ABOVE_MAX_SAFE_MINOR = '9007199254740992';
const AUGUST_START = '2026-07-31T16:00:00.000Z';
const AUGUST_END = '2026-08-31T16:00:00.000Z';

// This runs against the fully replayed schema. Every assertion below observes
// executed PostgreSQL behavior; none of the migration SQL is inspected as text.
export async function verifyFinanceAccountingIntegrity(database) {
  const orderJournal = await post(database, {
    referenceType: 'order.placed',
    referenceId: 'audit-order',
    description: 'Accrue the external-tender order receivable',
    debitCode: 'order.receivable.audit-order',
    debitKind: 'asset',
    creditCode: 'commerce.revenue',
    creditKind: 'income',
    amount: MAX_SAFE_MINOR,
    occurredAt: '2026-07-31T15:59:59.999Z',
  });
  const paymentJournal = await post(database, {
    referenceType: 'payment.succeeded',
    referenceId: 'audit-payment',
    description: 'Clear the captured external tender',
    debitCode: 'channel.clearing.wechat',
    debitKind: 'asset',
    creditCode: 'order.receivable.audit-order',
    creditKind: 'asset',
    amount: '400',
    occurredAt: AUGUST_START,
  });

  await expectDatabaseError(
    () =>
      post(database, {
        referenceType: 'order.placed',
        referenceId: 'audit-unsafe-order',
        description: 'Unsafe transport amount must be rejected',
        debitCode: 'order.receivable.audit-unsafe-order',
        debitKind: 'asset',
        creditCode: 'commerce.revenue',
        creditKind: 'income',
        amount: ABOVE_MAX_SAFE_MINOR,
        occurredAt: '2026-08-02T00:00:00.000Z',
      }),
    'FINANCE_POST_INVALID'
  );
  await expectDatabaseError(
    () =>
      database.query(
        `select finance.post($1,'order.placed','audit-usd-order','USD','Unsupported MVP currency',
          'order.receivable.audit-usd-order','asset','commerce.revenue','income',1,'2026-08-02T00:00:00.000Z')`,
        [SCOPE]
      ),
    'FINANCE_POST_INVALID'
  );

  await assertPeriodBounds(database);
  await assertTrialBalance(database, {
    opening: MAX_SAFE_MINOR,
    period: '400',
    closing: MAX_SAFE_MINOR,
    accountCount: '3',
  });
  await assertAccountLines(database, [
    ['channel.clearing.wechat', '0', '0', '400', '0', '400', '0'],
    ['commerce.revenue', '0', MAX_SAFE_MINOR, '0', '0', '0', MAX_SAFE_MINOR],
    ['order.receivable.audit-order', MAX_SAFE_MINOR, '0', '0', '400', '9007199254740591', '0'],
  ]);
  await assertSubledgers(
    database,
    [
      ['channel_clearing', 'wechat', '400', '0'],
      ['order_receivable', 'audit-order', MAX_SAFE_MINOR, '400'],
    ],
    '3'
  );
  await assertControl(database, { ready: true, hashesEqual: true, periodDebit: '400' });
  await assertControl(database, { ready: false, hashesEqual: true, periodDebit: '400', asOf: '2026-08-31T16:14:59.999Z', cutoffReached: false });

  const originalEvidence = await journalEvidence(database, paymentJournal);
  const reversalJournal = await reverse(database, paymentJournal, 'audit-payment-reversal', 'Provider capture was duplicated', 'finance-auditor', '2026-08-15T04:00:00.000Z');
  await assertReversal(database, paymentJournal, reversalJournal);
  assertEqual(await journalEvidence(database, paymentJournal), originalEvidence, 'FINANCE_REVERSAL_MUTATED_SOURCE');
  assertEqual(await reverse(database, paymentJournal, 'audit-payment-reversal', 'Provider capture was duplicated', 'finance-auditor', '2026-08-15T04:00:00.000Z'), reversalJournal, 'FINANCE_REVERSAL_RETRY_CHANGED_RESULT');
  await expectDatabaseError(() => database.query("update finance.entry set amount_minor=401 where journal_id=$1 and side='debit'", [paymentJournal]), 'FINANCE_LEDGER_APPEND_ONLY');
  await expectDatabaseError(() => database.query("update finance.journal set description='mutated' where id=$1", [paymentJournal]), 'FINANCE_LEDGER_APPEND_ONLY');
  await expectDatabaseError(() => reverse(database, paymentJournal, 'audit-duplicate-reversal', 'Duplicate reversal', 'finance-auditor', '2026-08-16T04:00:00.000Z'), 'FINANCE_JOURNAL_ALREADY_REVERSED');
  await assertTrialBalance(database, {
    opening: MAX_SAFE_MINOR,
    period: '800',
    closing: MAX_SAFE_MINOR,
    accountCount: '3',
  });
  await assertSubledgers(
    database,
    [
      ['channel_clearing', 'wechat', '400', '400'],
      ['order_receivable', 'audit-order', '9007199254741391', '400'],
    ],
    '5'
  );
  await assertControl(database, { ready: true, hashesEqual: true, periodDebit: '800' });

  await insertBalancedMaintenanceJournal(database);
  await assertControl(database, { ready: false, hashesEqual: false, periodDebit: '800' });
  await database.query("select finance.refresh_trial_balance($1,$2,'2026-08',false)", [SCOPE, CURRENCY]);
  await assertTrialBalance(database, {
    opening: MAX_SAFE_MINOR,
    period: '807',
    closing: '9007199254740998',
    accountCount: '5',
  });
  await assertControl(database, { ready: true, hashesEqual: true, periodDebit: '807' });
  await assertPeriodCloseDependencies(database);

  const correctableJournal = await post(database, {
    referenceType: 'order.placed',
    referenceId: 'audit-correctable-order',
    description: 'Original receivable requiring an append-only correction',
    debitCode: 'order.receivable.audit-correctable-order',
    debitKind: 'asset',
    creditCode: 'commerce.revenue',
    creditKind: 'income',
    amount: '100',
    occurredAt: '2026-09-01T04:00:00.000Z',
  });
  const correctableEvidence = await journalEvidence(database, correctableJournal);
  const correctionInput = {
    journal: correctableJournal,
    reference: 'audit-correctable-order-v2',
    reason: 'The external tender amount was overstated',
    actor: 'finance-correction-auditor',
    debitCode: 'order.receivable.audit-correctable-order',
    debitKind: 'asset',
    creditCode: 'commerce.revenue',
    creditKind: 'income',
    amount: '80',
    occurredAt: '2026-09-02T04:00:00.000Z',
  };
  const correctionJournal = await correct(database, correctionInput);
  await assertCorrection(database, correctableJournal, correctionJournal, correctionInput);
  assertEqual(await journalEvidence(database, correctableJournal), correctableEvidence, 'FINANCE_CORRECTION_MUTATED_SOURCE');
  assertEqual(await correct(database, correctionInput), correctionJournal, 'FINANCE_CORRECTION_RETRY_CHANGED_RESULT');
  await expectDatabaseError(() => correct(database, { ...correctionInput, amount: '79' }), 'FINANCE_CORRECTION_IDEMPOTENCY_MISMATCH');
  await expectDatabaseError(() => correct(database, { ...correctionInput, reference: 'audit-correctable-order-v3' }), 'FINANCE_CORRECTION_IDEMPOTENCY_MISMATCH');
  await expectDatabaseError(() => reverse(database, correctableJournal, 'audit-reverse-corrected-source', 'Correction already superseded the source', 'finance-auditor', '2026-09-03T04:00:00.000Z'), 'FINANCE_JOURNAL_ALREADY_CORRECTED');
  await expectDatabaseError(() => correct(database, { ...correctionInput, journal: paymentJournal, reference: 'audit-correct-reversed-payment' }), 'FINANCE_CORRECTION_SOURCE_REVERSED');
  await expectDatabaseError(() => correct(database, { ...correctionInput, journal: orderJournal, reference: 'audit-correct-unsafe', amount: ABOVE_MAX_SAFE_MINOR }), 'FINANCE_CORRECTION_INVALID');
  await expectDatabaseError(
    () =>
      correct(database, {
        ...correctionInput,
        journal: orderJournal,
        reference: 'audit-correct-rule-mismatch',
        debitCode: 'channel.clearing.wechat',
      }),
    'FINANCE_ACCOUNTING_EVENT_ACCOUNT_MISMATCH'
  );
  await expectDatabaseError(() => correct(database, { ...correctionInput, scope: 'scope:finance-accounting-other' }), 'FINANCE_CORRECTION_SOURCE_MISSING');
  await assertCorrectionTrialBalance(database, correctionJournal);
  await assertCorrectionExecutionBoundary(database);

  await database.query("update finance.period set state='closing' where scope_id=$1 and period='2026-08'", [SCOPE]);
  await expectDatabaseError(
    () =>
      post(database, {
        referenceType: 'order.placed',
        referenceId: 'audit-late-closing',
        description: 'Late posting during closing',
        debitCode: 'order.receivable.audit-late-closing',
        debitKind: 'asset',
        creditCode: 'commerce.revenue',
        creditKind: 'income',
        amount: '1',
        occurredAt: '2026-08-20T00:00:00.000Z',
      }),
    'FINANCE_PERIOD_NOT_OPEN'
  );
  await database.query("update finance.period set state='closed',closed_at=clock_timestamp(),closed_by='finance-auditor' where scope_id=$1 and period='2026-08'", [SCOPE]);
  assertEqual(
    await post(database, {
      referenceType: 'payment.succeeded',
      referenceId: 'audit-payment',
      description: 'Clear the captured external tender',
      debitCode: 'channel.clearing.wechat',
      debitKind: 'asset',
      creditCode: 'order.receivable.audit-order',
      creditKind: 'asset',
      amount: '400',
      occurredAt: AUGUST_START,
    }),
    paymentJournal,
    'FINANCE_CLOSED_PERIOD_REPLAY_CHANGED_RESULT'
  );
  await expectDatabaseError(
    () =>
      post(database, {
        referenceType: 'payment.succeeded',
        referenceId: 'audit-payment',
        description: 'Clear the captured external tender',
        debitCode: 'channel.clearing.wechat',
        debitKind: 'asset',
        creditCode: 'order.receivable.audit-order',
        creditKind: 'asset',
        amount: '401',
        occurredAt: AUGUST_START,
      }),
    'FINANCE_IDEMPOTENCY_MISMATCH'
  );
  await expectDatabaseError(
    () =>
      post(database, {
        referenceType: 'order.placed',
        referenceId: 'audit-late-closed',
        description: 'Late posting after close',
        debitCode: 'order.receivable.audit-late-closed',
        debitKind: 'asset',
        creditCode: 'commerce.revenue',
        creditKind: 'income',
        amount: '1',
        occurredAt: '2026-08-21T00:00:00.000Z',
      }),
    'FINANCE_PERIOD_NOT_OPEN'
  );
  await expectDatabaseError(() => reverse(database, orderJournal, 'audit-late-reversal', 'Late reversal after close', 'finance-auditor', '2026-08-22T00:00:00.000Z'), 'FINANCE_PERIOD_NOT_OPEN');
  await expectDatabaseError(
    () =>
      correct(database, {
        ...correctionInput,
        journal: orderJournal,
        reference: 'audit-late-correction',
        occurredAt: '2026-08-22T00:00:00.000Z',
      }),
    'FINANCE_PERIOD_NOT_OPEN'
  );

  const journalCount = await database.query(
    `select count(*)::text count from finance.journal
    where scope_id=$1 and reference_id in(
      'audit-unsafe-order','audit-late-closing','audit-late-closed','audit-late-reversal',
      'audit-usd-order','audit-correct-unsafe','audit-correct-rule-mismatch','audit-late-correction'
    )`,
    [SCOPE]
  );
  assertEqual(journalCount.rows[0]?.count, '0', 'FINANCE_REJECTED_POSTING_LEAKED');
  console.log('finance accounting integrity passed: trialBalance=exact subledger=consistent reversal=immutable correction=append-only periodControl=events+jobs+settlements+journals');
}

async function post(database, input) {
  const result = await database.query(
    `select finance.post(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::bigint,$11::timestamptz
  ) journal`,
    [SCOPE, input.referenceType, input.referenceId, CURRENCY, input.description, input.debitCode, input.debitKind, input.creditCode, input.creditKind, input.amount, input.occurredAt]
  );
  const journal = result.rows[0]?.journal;
  if (typeof journal !== 'string' || journal === '') throw new Error('FINANCE_POST_DID_NOT_RETURN_JOURNAL');
  return journal;
}

async function reverse(database, journal, reference, reason, actor, occurredAt) {
  const result = await database.query(
    `select finance.reverse(
    $1,$2,$3,$4,$5,$6::timestamptz
  ) journal`,
    [SCOPE, journal, reference, reason, actor, occurredAt]
  );
  const reversal = result.rows[0]?.journal;
  if (typeof reversal !== 'string' || reversal === '') throw new Error('FINANCE_REVERSAL_DID_NOT_RETURN_JOURNAL');
  return reversal;
}

async function correct(database, input) {
  const result = await database.query(
    `select finance.correct(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::bigint,$11::timestamptz
  ) journal`,
    [input.scope ?? SCOPE, input.journal, input.reference, input.reason, input.actor, input.debitCode, input.debitKind, input.creditCode, input.creditKind, input.amount, input.occurredAt]
  );
  const correction = result.rows[0]?.journal;
  if (typeof correction !== 'string' || correction === '') throw new Error('FINANCE_CORRECTION_DID_NOT_RETURN_JOURNAL');
  return correction;
}

async function assertPeriodBounds(database) {
  const result = await database.query(
    `select legal_timezone,
    to_char(period_start_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') period_start,
    to_char(period_end_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') period_end
    from finance.period where scope_id=$1 and period='2026-08'`,
    [SCOPE]
  );
  assertRows(result.rows, [['Asia/Shanghai', AUGUST_START, AUGUST_END]], ['legal_timezone', 'period_start', 'period_end'], 'FINANCE_LEGAL_PERIOD_BOUNDS_INVALID');
}

async function assertTrialBalance(database, expected) {
  const result = await database.query(
    `select opening_debit_minor::text opening_debit,
    opening_credit_minor::text opening_credit,debit_minor::text period_debit,
    credit_minor::text period_credit,closing_debit_minor::text closing_debit,
    closing_credit_minor::text closing_credit,account_count::text account_count,balanced
    from finance.statement where scope_id=$1 and period_start='2026-08-01'
      and calculation_version=2 and state='draft'`,
    [SCOPE]
  );
  assertRows(
    result.rows,
    [[expected.opening, expected.opening, expected.period, expected.period, expected.closing, expected.closing, expected.accountCount, true]],
    ['opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit', 'account_count', 'balanced'],
    'FINANCE_TRIAL_BALANCE_INVALID'
  );
}

async function assertAccountLines(database, expected) {
  const result = await database.query(
    `select account_code,
    opening_debit_minor::text opening_debit,opening_credit_minor::text opening_credit,
    period_debit_minor::text period_debit,period_credit_minor::text period_credit,
    closing_debit_minor::text closing_debit,closing_credit_minor::text closing_credit
    from finance.statementaccount where scope_id=$1
      and statement_id=(select id from finance.statement where scope_id=$1
        and period_start='2026-08-01' and calculation_version=2 and state='draft')
    order by account_code`,
    [SCOPE]
  );
  assertRows(result.rows, expected, ['account_code', 'opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit'], 'FINANCE_ACCOUNT_TRIAL_BALANCE_INVALID');
}

async function assertSubledgers(database, expected, expectedEntryCount) {
  const balances = await database.query(
    `select subledger.kind,subledger.subject_id,
    coalesce(sum(entry.amount_minor) filter(where entry.side='debit'),0)::text debit,
    coalesce(sum(entry.amount_minor) filter(where entry.side='credit'),0)::text credit
    from finance.subledger subledger join finance.subledgerentry entry on entry.subledger_id=subledger.id
    where subledger.scope_id=$1 group by subledger.kind,subledger.subject_id
    order by subledger.kind,subledger.subject_id`,
    [SCOPE]
  );
  assertRows(balances.rows, expected, ['kind', 'subject_id', 'debit', 'credit'], 'FINANCE_SUBLEDGER_BALANCE_INVALID');
  const coverage = await database.query(
    `with classified as(
      select entry.id from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
      join finance.account account on account.id=entry.account_id
      where journal.scope_id=$1 and exists(select 1 from finance.classify_subledger(account.code))
    ) select (select count(*)::text from classified) classified,
      (select count(*)::text from finance.subledgerentry where scope_id=$1) captured,
      finance.subledger_consistent($1,$2,'2026-08') consistent`,
    [SCOPE, CURRENCY]
  );
  assertRows(coverage.rows, [[expectedEntryCount, expectedEntryCount, true]], ['classified', 'captured', 'consistent'], 'FINANCE_SUBLEDGER_GENERAL_LEDGER_DRIFT');
}

async function assertControl(database, expected) {
  const result = await database.query(
    `select source_hash=current_hash hashes_equal,balanced,
    subledger_consistent,unresolved_differences::text unresolved,unposted_journals::text unposted,
    uncertain_payouts::text uncertain,unprocessed_finance_events::text unprocessed_events,
    incomplete_finance_jobs::text incomplete_jobs,
    unsettled_approved_reconciliations::text unsettled_reconciliations,
    missing_settlement_journals::text missing_journals,cutoff_reached,ready,
    (select debit_minor::text from finance.statement where id=statement_id) period_debit
    from finance.period_control($1,$2,'2026-08',$3::timestamptz)`,
    [SCOPE, CURRENCY, expected.asOf ?? '2026-08-31T16:15:00.000Z']
  );
  assertRows(
    result.rows,
    [
      [
        expected.hashesEqual,
        true,
        true,
        '0',
        '0',
        '0',
        expected.unprocessedEvents ?? '0',
        expected.incompleteJobs ?? '0',
        expected.unsettledReconciliations ?? '0',
        expected.missingJournals ?? '0',
        expected.cutoffReached ?? true,
        expected.ready,
        expected.periodDebit,
      ],
    ],
    ['hashes_equal', 'balanced', 'subledger_consistent', 'unresolved', 'unposted', 'uncertain', 'unprocessed_events', 'incomplete_jobs', 'unsettled_reconciliations', 'missing_journals', 'cutoff_reached', 'ready', 'period_debit'],
    'FINANCE_PERIOD_CONTROL_INVALID'
  );
}

async function assertPeriodCloseDependencies(database) {
  await database.query(
    `insert into runtime.outbox(
      id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at
    ) values(
      'event:audit-period-close','order.cancelled',1,'order','audit-period-close',$1,
      '{"order":"audit-period-close","reason":"audit"}'::jsonb,'trace:audit-period-close',
      '2026-08-20T04:00:00.000Z','2026-08-20T04:00:00.000Z'
    )`,
    [SCOPE]
  );
  await assertControl(database, {
    ready: false,
    hashesEqual: true,
    periodDebit: '807',
    unprocessedEvents: '1',
  });

  await database.query(
    `insert into runtime.inbox(
      consumer,event_id,event_type,event_version,trace_id,payload,received_at,processed_at,attempts
    ) values(
      'job:reconciliation','event:audit-period-close','order.cancelled',1,'trace:audit-period-close',
      '{"order":"audit-period-close","reason":"audit"}'::jsonb,
      '2026-08-20T04:00:00.000Z','2026-08-20T04:00:01.000Z',1
    )`
  );
  await database.query(
    `insert into runtime.job(
      id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at
    ) values(
      'job:audit-period-close-event','reconciliation','reconciliation',$1,
      '{"eventId":"event:audit-period-close"}'::jsonb,'queued',50,
      '2026-08-20T04:00:00.000Z','2026-08-20T04:00:00.000Z','2026-08-20T04:00:00.000Z'
    )`,
    [SCOPE]
  );
  await assertControl(database, {
    ready: false,
    hashesEqual: true,
    periodDebit: '807',
    incompleteJobs: '1',
  });
  await database.query(
    `update runtime.job set state='completed',updated_at='2026-08-20T04:00:02.000Z'
    where id='job:audit-period-close-event'`
  );
  await assertControl(database, { ready: true, hashesEqual: true, periodDebit: '807' });

  await database.query(
    `insert into channel.connection(
      id,provider,scope_id,status,contract_version,configuration,connection_timeout_ms,
      response_timeout_ms,total_deadline_ms,max_concurrency,requests_per_second,max_attempts,
      failure_threshold,recovery_ms,region
    ) values(
      'connection:audit-period-close','wechat',$1,'enabled','audit-v1','{}'::jsonb,
      1000,2000,3000,1,1,1,1,100,'local'
    )`,
    [SCOPE]
  );
  await database.query(
    `insert into channel.statement(
      id,connection_id,provider,scope_id,partner_id,period_start,period_end,timezone,
      object_ref,sha256,generated_at
    ) values(
      'statement:audit-period-close','connection:audit-period-close','wechat',$1,
      'partner:audit-period-close','2026-08-01','2026-08-31','Asia/Shanghai',
      'object:audit-period-close',repeat('a',64),'2026-08-31T15:59:59.999Z'
    )`,
    [SCOPE]
  );
  await database.query(
    `insert into finance.reconciliation(
      id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,
      debit_minor,credit_minor,difference_minor,created_by,approved_by,evidence,updated_at,version
    ) values(
      'reconciliation:audit-period-close',$1,'wechat','partner:audit-period-close',
      '2026-08-01/2026-08-31','statement:audit-period-close',repeat('a',64),'approved',
      1000,1000,0,'finance-requester','finance-approver','{}'::jsonb,
      '2026-08-31T15:59:59.999Z',1
    )`,
    [SCOPE]
  );
  await database.query(
    `insert into runtime.job(
      id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at
    ) values(
      'job:audit-period-close-settlement','settlement','finance',$1,
      '{"reconciliation":"reconciliation:audit-period-close"}'::jsonb,'queued',20,
      '2026-08-31T15:59:59.999Z','2026-08-31T15:59:59.999Z','2026-08-31T15:59:59.999Z'
    )`,
    [SCOPE]
  );
  await assertControl(database, {
    ready: false,
    hashesEqual: true,
    periodDebit: '807',
    incompleteJobs: '1',
    unsettledReconciliations: '1',
  });
  await database.query(
    `update runtime.job set state='completed',updated_at='2026-08-31T16:00:00.000Z'
    where id='job:audit-period-close-settlement'`
  );
  await assertControl(database, {
    ready: false,
    hashesEqual: true,
    periodDebit: '807',
    unsettledReconciliations: '1',
  });

  await database.query(
    `insert into finance.settlement(
      id,partner_id,period,reconciliation_id,amount_minor,currency,state,scope_id,
      requested_by,approved_by,frozen_at,approved_at,evidence,version,gross_minor,fee_minor,invoice_basis
    ) values(
      'settlement:audit-period-close','partner:audit-period-close','2026-08-01/2026-08-31',
      'reconciliation:audit-period-close',900,'CNY','payable',$1,'finance-requester',
      'finance-approver','2026-08-31T15:59:59.000Z','2026-08-31T15:59:59.999Z',
      '{"snapshot":"audit"}'::jsonb,1,1000,100,'net'
    )`,
    [SCOPE]
  );
  await assertControl(database, {
    ready: false,
    hashesEqual: true,
    periodDebit: '807',
    missingJournals: '2',
  });

  await post(database, {
    referenceType: 'finance.settlement.approved',
    referenceId: 'settlement:audit-period-close:partner',
    description: 'Settlement liability accrual',
    debitCode: 'settlement.cost',
    debitKind: 'expense',
    creditCode: 'settlement.payable.partner:audit-period-close',
    creditKind: 'liability',
    amount: '900',
    occurredAt: '2026-08-31T15:59:59.999999Z',
  });
  await assertControl(database, {
    ready: false,
    hashesEqual: true,
    periodDebit: '1707',
    missingJournals: '1',
  });

  await post(database, {
    referenceType: 'finance.settlement.approved',
    referenceId: 'settlement:audit-period-close:platform',
    description: 'Settlement platform fee',
    debitCode: 'settlement.cost',
    debitKind: 'expense',
    creditCode: 'platform.fee',
    creditKind: 'income',
    amount: '100',
    occurredAt: '2026-08-31T15:59:59.999999Z',
  });
  await assertControl(database, { ready: true, hashesEqual: true, periodDebit: '1807' });
}

async function journalEvidence(database, journal) {
  const result = await database.query(
    `select encode(public.digest(
    journal.id||':'||journal.reference_type||':'||journal.reference_id||':'||journal.currency||':'||
    journal.period||':'||journal.state||':'||journal.description||':'||journal.posted_at||':'||
    journal.version||':'||journal.accounting_rule_version||':'||coalesce(journal.source_hash,'')||':'||
    string_agg(entry.id||':'||entry.account_id||':'||entry.side||':'||entry.amount_minor,',' order by entry.id),
    'sha256'),'hex') evidence
    from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
    where journal.id=$1 group by journal.id`,
    [journal]
  );
  const evidence = result.rows[0]?.evidence;
  if (typeof evidence !== 'string' || evidence.length !== 64) throw new Error('FINANCE_JOURNAL_EVIDENCE_INVALID');
  return evidence;
}

async function assertReversal(database, sourceJournal, reversalJournal) {
  const relation = await database.query(
    `select reference_type,reversal_of,correction_of,source_hash is not null source_hashed
    from finance.journal where id=$1`,
    [reversalJournal]
  );
  assertRows(relation.rows, [['finance.journal.reversal', sourceJournal, null, true]], ['reference_type', 'reversal_of', 'correction_of', 'source_hashed'], 'FINANCE_REVERSAL_RELATION_INVALID');
  const entries = await database.query(
    `select source.account_id,source.side source_side,target.side reversal_side,
    source.amount_minor::text source_amount,target.amount_minor::text reversal_amount
    from finance.entry source join finance.entry target
      on target.journal_id=$2 and target.account_id=source.account_id
    where source.journal_id=$1 order by source.account_id`,
    [sourceJournal, reversalJournal]
  );
  assertEqual(entries.rows.length, 2, 'FINANCE_REVERSAL_ENTRY_COUNT_INVALID');
  for (const row of entries.rows) {
    assertEqual(row.source_amount, row.reversal_amount, 'FINANCE_REVERSAL_AMOUNT_INVALID');
    assertEqual(row.reversal_side, row.source_side === 'debit' ? 'credit' : 'debit', 'FINANCE_REVERSAL_SIDE_INVALID');
  }
}

async function assertCorrection(database, sourceJournal, correctionJournal, input) {
  const relation = await database.query(
    `select reference_type,reversal_of,correction_of,source_hash is not null source_hashed,
    accounting_rule_version::text rule_version
    from finance.journal where id=$1`,
    [correctionJournal]
  );
  assertRows(relation.rows, [['finance.journal.correction', null, sourceJournal, true, '1']], ['reference_type', 'reversal_of', 'correction_of', 'source_hashed', 'rule_version'], 'FINANCE_CORRECTION_RELATION_INVALID');
  const neutralized = await database.query(
    `select source.account_id,source.side source_side,target.side correction_side,
    source.amount_minor::text source_amount,target.amount_minor::text correction_amount
    from finance.entry source join finance.entry target on target.id=
      'entry:'||substr(encode(public.digest($2||':reverse:'||source.id,'sha256'),'hex'),1,40)
    where source.journal_id=$1 and target.journal_id=$2 order by source.account_id`,
    [sourceJournal, correctionJournal]
  );
  assertEqual(neutralized.rows.length, 2, 'FINANCE_CORRECTION_NEUTRALIZATION_COUNT_INVALID');
  for (const row of neutralized.rows) {
    assertEqual(row.source_amount, row.correction_amount, 'FINANCE_CORRECTION_NEUTRALIZATION_AMOUNT_INVALID');
    assertEqual(row.correction_side, row.source_side === 'debit' ? 'credit' : 'debit', 'FINANCE_CORRECTION_NEUTRALIZATION_SIDE_INVALID');
  }
  const replacement = await database.query(
    `select account.code,entry.side,entry.amount_minor::text amount
    from finance.entry entry join finance.account account on account.id=entry.account_id
    where entry.journal_id=$1 and entry.id in(
      'entry:'||substr(encode(public.digest($1||':replacement:debit','sha256'),'hex'),1,40),
      'entry:'||substr(encode(public.digest($1||':replacement:credit','sha256'),'hex'),1,40)
    ) order by entry.side`,
    [correctionJournal]
  );
  assertRows(
    replacement.rows,
    [
      [input.creditCode, 'credit', input.amount],
      [input.debitCode, 'debit', input.amount],
    ],
    ['code', 'side', 'amount'],
    'FINANCE_CORRECTION_REPLACEMENT_INVALID'
  );
  const outbox = await database.query(
    `select payload->>'correctionOf' correction_of,payload->>'correctedReferenceType' corrected_type,
    payload->>'amountMinor' amount,payload->>'actor' actor,length(payload->>'sourceEvidence') evidence_length
    from runtime.outbox where aggregate_id=$1 and event_type='finance.entry.posted'`,
    [correctionJournal]
  );
  assertRows(outbox.rows, [[sourceJournal, 'order.placed', input.amount, input.actor, 64]], ['correction_of', 'corrected_type', 'amount', 'actor', 'evidence_length'], 'FINANCE_CORRECTION_RECEIPT_INVALID');
}

async function assertCorrectionTrialBalance(database, correctionJournal) {
  const result = await database.query(
    `select statement.debit_minor::text debit,statement.credit_minor::text credit,statement.balanced,
    finance.subledger_consistent($1,$2,'2026-09') subledger_consistent,
    (select coalesce(sum(case when entry.side='debit' then entry.amount_minor else -entry.amount_minor end),0)::text
      from finance.entry entry where entry.journal_id=$3) correction_balance,
    (select coalesce(sum(case when entry.side='debit' then entry.amount_minor else -entry.amount_minor end),0)::text
      from finance.entry entry join finance.account account on account.id=entry.account_id
      where entry.journal_id in($3,(select correction_of from finance.journal where id=$3))
        and account.code='order.receivable.audit-correctable-order') receivable_balance
    from finance.statement statement where statement.scope_id=$1
      and statement.period_start='2026-09-01' and statement.calculation_version=2 and statement.state='draft'`,
    [SCOPE, CURRENCY, correctionJournal]
  );
  assertRows(result.rows, [['280', '280', true, true, '0', '80']], ['debit', 'credit', 'balanced', 'subledger_consistent', 'correction_balance', 'receivable_balance'], 'FINANCE_CORRECTION_TRIAL_BALANCE_INVALID');
}

async function assertCorrectionExecutionBoundary(database) {
  const result = await database.query(
    `select
    has_function_privilege('shopapp',
      'finance.correct(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone)','EXECUTE') app_execute,
    has_function_privilege('shopjob',
      'finance.correct(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone)','EXECUTE') job_execute,
    has_function_privilege('service_role',
      'finance.correct(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone)','EXECUTE') service_execute`
  );
  assertRows(result.rows, [[false, false, false]], ['app_execute', 'job_execute', 'service_execute'], 'FINANCE_CORRECTION_REVIEW_BOUNDARY_OPEN');
}

async function insertBalancedMaintenanceJournal(database) {
  const accounts = await database.query(
    `select
    finance.ensure_account($1,'audit.control.asset',$2,'asset') debit,
    finance.ensure_account($1,'audit.control.equity',$2,'equity') credit`,
    [SCOPE, CURRENCY]
  );
  const debit = accounts.rows[0]?.debit;
  const credit = accounts.rows[0]?.credit;
  if (typeof debit !== 'string' || typeof credit !== 'string') throw new Error('FINANCE_CONTROL_ACCOUNT_MISSING');
  await database.query('begin');
  try {
    await database.query(
      `insert into finance.journal(
      id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version,
      accounting_rule_version,source_hash
    ) values(
      'journal:finance-accounting-control',$1,'payment','audit-control-journal',$2,
      '2026-08','posted','Privileged balanced control journal','2026-08-18T04:00:00.000Z',0,1,$3
    )`,
      [SCOPE, CURRENCY, 'c'.repeat(64)]
    );
    await database.query(
      `insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at) values
      ('entry:finance-accounting-control:debit','journal:finance-accounting-control',$1,'debit',7,'2026-08-18T04:00:00.000Z'),
      ('entry:finance-accounting-control:credit','journal:finance-accounting-control',$2,'credit',7,'2026-08-18T04:00:00.000Z')`,
      [debit, credit]
    );
    await database.query('commit');
  } catch (error) {
    await database.query('rollback');
    throw error;
  }
}

async function expectDatabaseError(action, expectedCode) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(expectedCode)) return;
    throw new Error(`FINANCE_DATABASE_ERROR_MISMATCH:${JSON.stringify({ expectedCode, message })}`, { cause: error });
  }
  throw new Error(`FINANCE_DATABASE_ERROR_NOT_RAISED:${expectedCode}`);
}

function assertRows(rows, expected, columns, code) {
  const actual = rows.map((row) => columns.map((column) => row[column]));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${code}:${JSON.stringify({ expected, actual })}`);
  }
}

function assertEqual(actual, expected, code) {
  if (actual !== expected) throw new Error(`${code}:${JSON.stringify({ expected, actual })}`);
}
