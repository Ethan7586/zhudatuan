import { createHash } from 'node:crypto';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import { parseCsvDocument } from '../../../../foundation/infrastructure/Csv';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';

export class ReconcileStatement {
  constructor(
    private readonly pool: DatabasePool,
    private readonly objects: ObjectStore
  ) {}

  async execute(id: string): Promise<void> {
    const declared = await this.pool.query<{ provider: string }>('select provider from finance.reconciliation where id=$1', [id]);
    if (!declared.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
    if (declared.rows[0].provider !== 'wechat') throw new Error('FINANCE_RECONCILIATION_PROVIDER_UNSUPPORTED');
    const loaded = await this.pool.query<Source>(
      `update finance.reconciliation reconciliation set state='matching'
      from channel.statement statement where reconciliation.id=$1 and reconciliation.statement_ref=statement.id
      and reconciliation.scope_id=statement.scope_id and reconciliation.provider=statement.provider
      and reconciliation.partner_id=statement.partner_id and reconciliation.statement_hash=statement.sha256
      and reconciliation.period=statement.period_start::text||'/'||statement.period_end::text
      and reconciliation.provider='wechat' and reconciliation.state in('received','matching','difference')
      returning reconciliation.scope_id,reconciliation.statement_hash,
      reconciliation.provider,statement.object_ref,statement.period_start::text,statement.period_end::text,statement.timezone`,
      [id]
    );
    const source = loaded.rows[0];
    if (!source) throw new Error('RECONCILIATION_NOT_RUNNABLE');
    const bytes = await this.objects.read(source.object_ref, 64 * 1024 * 1024);
    if (createHash('sha256').update(bytes).digest('hex') !== source.statement_hash) throw new Error('STATEMENT_INTEGRITY_FAILED');
    const validated = validate(parseCsvDocument(bytes, 1_000_000));
    const rows = validated.rows;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (let offset = 0; offset < rows.length; offset += 5_000) {
        const values = rows.slice(offset, offset + 5_000).map((row, index) => ({
          sequence: offset + index + 1,
          reference: row.reference,
          kind: row.type,
          amount: row.amountMinor,
          tax: row.taxMinor,
          currency: row.currency,
          occurred: row.occurredAt,
          hash: createHash('sha256').update(JSON.stringify(row)).digest('hex'),
        }));
        const timing = await client.query<{ invalid: number }>(
          `select count(*)::integer invalid
          from jsonb_to_recordset($1::jsonb) record(occurred timestamptz)
          where record.occurred<($2::date::timestamp at time zone $4)
            or record.occurred>=(($3::date+1)::timestamp at time zone $4)`,
          [JSON.stringify(values), source.period_start, source.period_end, source.timezone]
        );
        if (timing.rows[0]?.invalid !== 0) throw new Error('STATEMENT_OCCURRED_AT_OUTSIDE_PERIOD');
        await client.query(
          `insert into finance.statementline(id,reconciliation_id,scope_id,sequence,external_reference,kind,amount_minor,
          tax_minor,currency,occurred_at,raw_hash) select 'statementline:'||$1||':'||record.sequence,$1,$2,record.sequence,
          record.reference,record.kind,record.amount,record.tax,record.currency,record.occurred,record.hash
          from jsonb_to_recordset($3::jsonb) record(sequence integer,reference text,kind text,amount bigint,tax bigint,currency char(3),
            occurred timestamptz,hash char(64)) on conflict(reconciliation_id,sequence) do nothing`,
          [id, source.scope_id, JSON.stringify(values)]
        );
      }
      await match(client, id, source);
      const internal = await client.query<{ payments: string; refunds: string; differences: number }>(
        `select coalesce(sum(item.internal_minor) filter(where item.kind='payment'),0)::text payments,
        coalesce(sum(item.internal_minor) filter(where item.kind='refund'),0)::text refunds,
        count(*) filter(where item.state='difference')::integer differences from finance.reconciliationitem item
        where item.reconciliation_id=$1`,
        [id]
      );
      const summary = internal.rows[0]!;
      const internalPayments = unsignedMinor(summary.payments, 'RECONCILIATION_INTERNAL_TOTAL_OVERFLOW');
      const internalRefunds = unsignedMinor(summary.refunds, 'RECONCILIATION_INTERNAL_TOTAL_OVERFLOW');
      const internalNet = signedMinor(internalPayments - internalRefunds, 'RECONCILIATION_INTERNAL_TOTAL_OVERFLOW');
      const providerNet = validated.payments - validated.refunds;
      const differenceMinor = signedMinor(providerNet - internalNet, 'RECONCILIATION_DIFFERENCE_OVERFLOW');
      const result = await client.query(
        `update finance.reconciliation set debit_minor=$2::bigint,credit_minor=$3::bigint,
        difference_minor=$2::bigint-$3::bigint,evidence=$4::jsonb,
        state=case when $5::integer=0 and $2::bigint=$3::bigint then 'balanced' else 'difference' end,updated_at=clock_timestamp(),
        version=version+1 where id=$1 and state='matching' returning *`,
        [
          id,
          providerNet.toString(),
          internalNet.toString(),
          JSON.stringify({
            rowCount: rows.length,
            provider: { payments: validated.payments.toString(), refunds: validated.refunds.toString() },
            internal: { payments: internalPayments.toString(), refunds: internalRefunds.toString(), net: internalNet.toString() },
            differences: summary.differences,
            statementHash: source.statement_hash,
          }),
          summary.differences,
        ]
      );
      if (!result.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
      if (summary.differences > 0 || differenceMinor !== 0n) await difference(client, id, source.scope_id, differenceMinor, summary.differences);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

async function match(database: Database, id: string, source: Source): Promise<void> {
  await database.query(
    `create temporary table reconciliation_internal_fact on commit drop as
    with paymentfact as(
      select journal.id journal_id,'payment'::text kind,'payment'::text internal_type,payment.id internal_id,
        tender.amount_minor internal_minor,case when journal.id is null then null else ledger.amount_minor end journal_minor,
        tender.amount_minor tender_minor,payment.amount_minor aggregate_minor,
        payment.amount_minor payment_minor,allocation.allocation_count,allocation.allocation_minor,allocation.allocations,
        providerref.provider_references,providerref.provider_record_count,journal.currency journal_currency,
        payment.currency source_currency,capture.id capture_id,capture.currency capture_currency,
        capture.amount_minor capture_minor,capture.source capture_source,providerref.occurred_at,
        expected.reference_type journal_reference_type,related.reversal_id journal_reversal_id,
        related.correction_id journal_correction_id,
        (journal.id is not null and related.reversal_id is null and related.correction_id is null
          and expected.reference_type='payment.succeeded') settlement_eligible
      from payment.payment payment join payment.intent intent on intent.id=payment.intent_id
      join ordering.orderrecord orders on orders.id=intent.order_id and orders.scope_id=$1
      join payment.intenttender tender on tender.intent_id=intent.id and tender.kind='wechat' and tender.state='captured'
      cross join lateral(select count(*)::integer allocation_count,coalesce(sum(item.amount_minor),0)::bigint allocation_minor,
        coalesce(jsonb_agg(jsonb_build_object('targetType',item.target_type,'targetId',item.target_id,
          'amountMinor',item.amount_minor) order by item.target_type,item.target_id),'[]'::jsonb) allocations
        from payment.allocation item where item.payment_id=payment.id) allocation
      cross join lateral(select coalesce(array_agg(distinct candidate.reference order by candidate.reference)
          filter(where candidate.reference is not null and candidate.reference<>''),array[]::text[]) provider_references,
        count(distinct candidate.attempt_id) filter(where candidate.attempt_id is not null)::integer provider_record_count,
        max(candidate.completed_at) filter(where candidate.attempt_id is not null) occurred_at
        from (select intent.provider_reference reference,null::text attempt_id,null::timestamptz completed_at union all
          select attempt.external_transaction,attempt.id,attempt.completed_at from payment.attempt attempt
          where attempt.intent_id=intent.id and attempt.provider=$2::text and attempt.state='succeeded'
            and attempt.external_transaction is not null and attempt.completed_at is not null) candidate) providerref
      left join payment.capture capture on capture.order_id=orders.id and capture.scope_id=orders.scope_id and capture.state='succeeded'
      cross join lateral(values(case when capture.source='latewechat' then 'payment.late.detected'::text
        else 'payment.succeeded'::text end)) expected(reference_type)
      left join finance.journal journal on journal.scope_id=$1 and journal.reference_type=expected.reference_type
        and journal.reference_id=payment.id and journal.state='posted'
      left join lateral(select max(related.id) filter(where related.reversal_of=journal.id) reversal_id,
        max(related.id) filter(where related.correction_of=journal.id) correction_id
        from finance.journal related where related.state='posted'
          and (related.reversal_of=journal.id or related.correction_of=journal.id)) related on true
      left join lateral(select coalesce(sum(entry.amount_minor) filter(where entry.side='debit'),0)::bigint amount_minor
        from finance.entry entry where entry.journal_id=journal.id) ledger on true
      where $2::text='wechat' and payment.state in('captured','partially_refunded','refunded')
        and providerref.occurred_at>=($3::date::timestamp at time zone $5)
        and providerref.occurred_at<(($4::date+1)::timestamp at time zone $5)
    ),refundfact as(
      select journal.id journal_id,'refund'::text kind,'refund'::text internal_type,refund.id internal_id,
        tender.amount_minor internal_minor,case when journal.id is null then null else ledger.amount_minor end journal_minor,
        tender.amount_minor tender_minor,refund.amount_minor aggregate_minor,
        payment.amount_minor payment_minor,allocation.allocation_count,allocation.allocation_minor,allocation.allocations,
        providerref.provider_references,completion.provider_record_count,journal.currency journal_currency,
        refund.currency source_currency,capture.id capture_id,capture.currency capture_currency,
        capture.amount_minor capture_minor,capture.source capture_source,completion.occurred_at,
        expected.reference_type journal_reference_type,related.reversal_id journal_reversal_id,
        related.correction_id journal_correction_id,
        (journal.id is not null and related.reversal_id is null and related.correction_id is null
          and expected.reference_type='payment.refunded') settlement_eligible
      from payment.refund refund
      join payment.refundtender tender on tender.refund_id=refund.id and tender.kind='wechat' and tender.state='succeeded'
      join payment.payment payment on payment.id=refund.payment_id join payment.intent intent on intent.id=payment.intent_id
      join ordering.orderrecord orders on orders.id=intent.order_id and orders.scope_id=$1
      cross join lateral(select count(*)::integer allocation_count,coalesce(sum(item.amount_minor),0)::bigint allocation_minor,
        coalesce(jsonb_agg(jsonb_build_object('targetType',item.target_type,'targetId',item.target_id,
          'amountMinor',item.amount_minor) order by item.target_type,item.target_id),'[]'::jsonb) allocations
        from payment.allocation item where item.payment_id=payment.id) allocation
      cross join lateral(select coalesce(array_agg(distinct candidate.reference order by candidate.reference)
          filter(where candidate.reference is not null and candidate.reference<>''),array[]::text[]) provider_references
        from (values(refund.provider_reference),(refund.external_transaction),(tender.provider_reference)) candidate(reference)) providerref
      cross join lateral(select max(attempt.completed_at) occurred_at,
        count(distinct attempt.provider_reference) filter(where attempt.provider_reference is not null
          and attempt.provider_reference<>'')::integer provider_record_count
        from payment.providerattempt attempt where attempt.refund_id=refund.id and attempt.outcome='succeeded'
          and attempt.provider_state='succeeded' and attempt.completed_at is not null) completion
      left join payment.capture capture on capture.order_id=orders.id and capture.scope_id=orders.scope_id and capture.state='succeeded'
      cross join lateral(values(case when capture.source='latewechat' and refund.reason='latepayment'
        then 'payment.late.refunded'::text else 'payment.refunded'::text end)) expected(reference_type)
      left join finance.journal journal on journal.scope_id=$1 and journal.reference_type=expected.reference_type
        and journal.reference_id=refund.id and journal.state='posted'
      left join lateral(select max(related.id) filter(where related.reversal_of=journal.id) reversal_id,
        max(related.id) filter(where related.correction_of=journal.id) correction_id
        from finance.journal related where related.state='posted'
          and (related.reversal_of=journal.id or related.correction_of=journal.id)) related on true
      left join lateral(select coalesce(sum(entry.amount_minor) filter(where entry.side='debit'),0)::bigint amount_minor
        from finance.entry entry where entry.journal_id=journal.id) ledger on true
      where $2::text='wechat' and refund.state='succeeded'
        and completion.occurred_at>=($3::date::timestamp at time zone $5)
        and completion.occurred_at<(($4::date+1)::timestamp at time zone $5)
    )
    select fact.*,jsonb_build_object('source','authoritative_payment_tender','kind',fact.kind,'journal',fact.journal_id,
      'journalReferenceType',fact.journal_reference_type,'journalPosted',fact.journal_id is not null,
      'journalReversal',fact.journal_reversal_id,'journalCorrection',fact.journal_correction_id,
      'settlementEligible',fact.settlement_eligible,'aggregateType',fact.internal_type,'aggregateId',fact.internal_id,
      'provider',$2::text,'journalAmountMinor',fact.journal_minor,'occurredAt',fact.occurred_at,
      'tender',jsonb_build_object('kind','wechat','amountMinor',fact.tender_minor),'aggregateAmountMinor',fact.aggregate_minor,
      'paymentAmountMinor',fact.payment_minor,'allocationCount',fact.allocation_count,
      'allocationAmountMinor',fact.allocation_minor,'allocations',fact.allocations,
      'capture',jsonb_build_object('id',fact.capture_id,'source',fact.capture_source,'currency',fact.capture_currency,
        'amountMinor',fact.capture_minor),
      'providerReferences',to_jsonb(fact.provider_references)) source_evidence
    from (select * from paymentfact union all select * from refundfact) fact`,
    [source.scope_id, source.provider, source.period_start, source.period_end, source.timezone]
  );

  await database.query(
    `create temporary table reconciliation_retry_merge on commit drop as
    with edges as(
      select line.id line_id,fact.* from finance.statementline line join reconciliation_internal_fact fact
        on fact.kind=line.kind and line.external_reference=any(fact.provider_references) where line.reconciliation_id=$1),
    linestat as(select line_id,count(*)::integer candidate_count from edges group by line_id),
    factstat as(select edge.kind,edge.internal_type,edge.internal_id,count(*)::integer line_count,
      max(stat.candidate_count)::integer candidate_count from edges edge join linestat stat on stat.line_id=edge.line_id
      group by edge.kind,edge.internal_type,edge.internal_id),
    safe as(select edge.* from edges edge join linestat line on line.line_id=edge.line_id and line.candidate_count=1
      join factstat fact on fact.kind=edge.kind and fact.internal_type=edge.internal_type and fact.internal_id=edge.internal_id
        and fact.line_count=1)
    select internalitem.id survivor_item_id,statementitem.id retired_item_id,safe.line_id statement_line_id,
      jsonb_build_object('reason','REFERENCE_BECAME_AUTHORITATIVE','retiredItem',jsonb_build_object(
        'id',statementitem.id,'state',statementitem.state,'reasonCode',statementitem.reason_code,
        'version',statementitem.version,'evidence',statementitem.evidence),'survivorBefore',jsonb_build_object(
        'id',internalitem.id,'state',internalitem.state,'reasonCode',internalitem.reason_code,
        'version',internalitem.version,'evidence',internalitem.evidence)) merge_evidence
    from safe join finance.reconciliationitem statementitem on statementitem.reconciliation_id=$1
      and statementitem.statement_line_id=safe.line_id
    join finance.reconciliationitem internalitem on internalitem.reconciliation_id=$1
      and internalitem.statement_line_id is null and internalitem.kind=safe.kind
      and internalitem.internal_type=safe.internal_type and internalitem.internal_id=safe.internal_id
    where statementitem.id<>internalitem.id and statementitem.state in('matched','difference')
      and internalitem.state in('matched','difference')`,
    [id]
  );
  await database.query(
    `delete from finance.reconciliationitem item using reconciliation_retry_merge merge
    where item.id=merge.retired_item_id`
  );
  await database.query(
    `update finance.reconciliationitem item set statement_line_id=merge.statement_line_id,
      evidence=item.evidence||jsonb_build_object('retryMerge',merge.merge_evidence)
    from reconciliation_retry_merge merge where item.id=merge.survivor_item_id`
  );

  await database.query(
    `with edges as(
      select line.id line_id,fact.* from finance.statementline line join reconciliation_internal_fact fact
        on fact.kind=line.kind and line.external_reference=any(fact.provider_references) where line.reconciliation_id=$1),
    linestat as(select line_id,count(*)::integer candidate_count,coalesce(sum(internal_minor),0)::bigint candidate_minor,
      jsonb_agg(source_evidence order by internal_type,internal_id) candidates from edges group by line_id),
    factstat as(select edge.kind,edge.internal_type,edge.internal_id,count(*)::integer line_count,
      max(stat.candidate_count)::integer candidate_count from edges edge join linestat stat on stat.line_id=edge.line_id
      group by edge.kind,edge.internal_type,edge.internal_id),
    safe as(select edge.* from edges edge join linestat line on line.line_id=edge.line_id and line.candidate_count=1
      join factstat fact on fact.kind=edge.kind and fact.internal_type=edge.internal_type and fact.internal_id=edge.internal_id
        and fact.line_count=1),
    projected as(select line.id statement_line_id,line.kind,line.amount_minor external_minor,
      coalesce(safe.internal_minor,0)::bigint internal_minor,line.amount_minor-coalesce(safe.internal_minor,0) difference_minor,
      safe.internal_type,safe.internal_id,
      case when coalesce(stat.candidate_count,0)=0 then 'INTERNAL_REFERENCE_MISSING'
        when safe.internal_id is null then 'MANY_TO_ONE_UNSUPPORTED'
        when safe.provider_record_count<>1 then 'INTERNAL_PROVIDER_REFERENCE_INVALID'
        when safe.capture_id is null then 'INTERNAL_CAPTURE_MISSING'
        when safe.capture_currency<>safe.source_currency then 'INTERNAL_CAPTURE_CURRENCY_MISMATCH'
        when safe.capture_minor<>safe.payment_minor then 'INTERNAL_CAPTURE_AMOUNT_MISMATCH'
        when safe.allocation_count<>1 then 'MANY_TO_ONE_UNSUPPORTED'
        when safe.allocation_minor<>safe.payment_minor then 'INTERNAL_ALLOCATION_MISMATCH'
        when safe.journal_id is null then 'INTERNAL_JOURNAL_MISSING'
        when safe.journal_reversal_id is not null then 'INTERNAL_JOURNAL_REVERSED'
        when safe.journal_correction_id is not null then 'INTERNAL_JOURNAL_CORRECTED'
        when line.currency<>safe.journal_currency or line.currency<>safe.source_currency then 'INTERNAL_CURRENCY_MISMATCH'
        when safe.journal_minor<>safe.tender_minor then 'INTERNAL_JOURNAL_AMOUNT_MISMATCH'
        when line.amount_minor<>safe.internal_minor then 'AMOUNT_MISMATCH' end reason_code,
      jsonb_build_object('source','provider_statement','provider',$3::text,'externalReference',line.external_reference,
        'kind',line.kind,'rawHash',line.raw_hash,'candidateCount',coalesce(stat.candidate_count,0),
        'candidateAmountMinor',coalesce(stat.candidate_minor,0),'journalReferenceType',safe.journal_reference_type,
        'settlementEligible',coalesce(safe.settlement_eligible,false),
        'candidates',coalesce(stat.candidates,'[]'::jsonb)) evidence
      from finance.statementline line left join linestat stat on stat.line_id=line.id left join safe on safe.line_id=line.id
      where line.reconciliation_id=$1)
    insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,scope_id,kind,internal_type,internal_id,
      external_minor,internal_minor,difference_minor,state,reason_code,evidence,version)
    select 'reconciliationitem:'||statement_line_id,$1,statement_line_id,$2,kind,internal_type,internal_id,external_minor,
      internal_minor,difference_minor,case when reason_code is null then 'matched' else 'difference' end,reason_code,evidence,0
    from projected on conflict(statement_line_id) do update set kind=excluded.kind,internal_type=excluded.internal_type,
      internal_id=excluded.internal_id,external_minor=excluded.external_minor,internal_minor=excluded.internal_minor,
      difference_minor=excluded.difference_minor,state=excluded.state,reason_code=excluded.reason_code,
      evidence=excluded.evidence||case when finance.reconciliationitem.evidence?'retryMerge'
        then jsonb_build_object('retryMerge',finance.reconciliationitem.evidence->'retryMerge') else '{}'::jsonb end,
      resolution=null,resolved_by=null,approved_by=null,resolved_at=null,approved_at=null,
      version=finance.reconciliationitem.version+1 where finance.reconciliationitem.state in('matched','difference')`,
    [id, source.scope_id, source.provider]
  );

  await database.query(
    `with edges as(
      select line.id line_id,fact.kind,fact.internal_type,fact.internal_id from finance.statementline line
      join reconciliation_internal_fact fact on fact.kind=line.kind and line.external_reference=any(fact.provider_references)
      where line.reconciliation_id=$1),
    linestat as(select line_id,count(*)::integer candidate_count from edges group by line_id),
    factstat as(select edge.kind,edge.internal_type,edge.internal_id,count(*)::integer line_count,
      max(stat.candidate_count)::integer candidate_count from edges edge join linestat stat on stat.line_id=edge.line_id
      group by edge.kind,edge.internal_type,edge.internal_id),
    safe as(select edge.kind,edge.internal_type,edge.internal_id from edges edge join linestat line
      on line.line_id=edge.line_id and line.candidate_count=1 join factstat fact on fact.kind=edge.kind
      and fact.internal_type=edge.internal_type and fact.internal_id=edge.internal_id and fact.line_count=1)
    insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,scope_id,kind,internal_type,internal_id,
      external_minor,internal_minor,difference_minor,state,reason_code,evidence,version)
    select 'reconciliationitem:'||$1||':internal:'||substr(encode(public.digest(fact.kind||':'||fact.internal_id,'sha256'),'hex'),1,40),
      $1,null,$2,fact.kind,fact.internal_type,fact.internal_id,0,fact.internal_minor,-fact.internal_minor,'difference',
      case when coalesce(stat.line_count,0)>0 then 'MANY_TO_ONE_UNSUPPORTED'
        when fact.provider_record_count<>1 then 'INTERNAL_PROVIDER_REFERENCE_INVALID'
        when fact.capture_id is null then 'INTERNAL_CAPTURE_MISSING'
        when fact.capture_currency<>fact.source_currency then 'INTERNAL_CAPTURE_CURRENCY_MISMATCH'
        when fact.capture_minor<>fact.payment_minor then 'INTERNAL_CAPTURE_AMOUNT_MISMATCH'
        when fact.allocation_count<>1 then 'MANY_TO_ONE_UNSUPPORTED'
        when fact.allocation_minor<>fact.payment_minor then 'INTERNAL_ALLOCATION_MISMATCH'
        when fact.journal_id is null then 'INTERNAL_JOURNAL_MISSING'
        when fact.journal_reversal_id is not null then 'INTERNAL_JOURNAL_REVERSED'
        when fact.journal_correction_id is not null then 'INTERNAL_JOURNAL_CORRECTED'
        when fact.journal_currency<>fact.source_currency then 'INTERNAL_CURRENCY_MISMATCH'
        when fact.journal_minor<>fact.tender_minor then 'INTERNAL_JOURNAL_AMOUNT_MISMATCH'
        else 'EXTERNAL_REFERENCE_MISSING' end,
      fact.source_evidence||jsonb_build_object('statementSource','provider_statement','statementProvider',$3::text,
        'matchedStatementLineCount',coalesce(stat.line_count,0)),0
    from reconciliation_internal_fact fact left join factstat stat on stat.kind=fact.kind and stat.internal_type=fact.internal_type
      and stat.internal_id=fact.internal_id left join safe on safe.kind=fact.kind and safe.internal_type=fact.internal_type
      and safe.internal_id=fact.internal_id where safe.internal_id is null
    on conflict(reconciliation_id,kind,internal_type,internal_id)
      where internal_type is not null and internal_id is not null do update set statement_line_id=null,
      external_minor=excluded.external_minor,internal_minor=excluded.internal_minor,difference_minor=excluded.difference_minor,
      state=excluded.state,reason_code=excluded.reason_code,evidence=excluded.evidence,resolution=null,resolved_by=null,
      approved_by=null,resolved_at=null,approved_at=null,version=finance.reconciliationitem.version+1
      where finance.reconciliationitem.state in('matched','difference')`,
    [id, source.scope_id, source.provider]
  );
}

async function difference(database: Database, id: string, scope: string, amount: bigint, count: number): Promise<void> {
  await database.query(
    `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,
    available_at) values($1::text,'finance.reconciliation.difference',1,'reconciliation',$2::text,$3::text,
    jsonb_build_object('reconciliation',$2::text,'differenceMinor',$4::bigint,'itemCount',$5::integer),$1::text,
    clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
    [`event:${digest(`finance:reconciliation:${id}`)}`, id, scope, amount.toString(), count]
  );
}

function validate(document: Readonly<{ headers: readonly string[]; rows: readonly Readonly<Record<string, string>>[] }>): Readonly<{ rows: readonly NormalizedRow[]; payments: bigint; refunds: bigint }> {
  const legacyHeaders = ['reference', 'type', 'amountMinor', 'currency', 'occurredAt'];
  const canonicalHeaders = ['reference', 'type', 'amountMinor', 'taxMinor', 'currency', 'occurredAt'];
  if (!same(document.headers, legacyHeaders) && !same(document.headers, canonicalHeaders)) throw new Error('STATEMENT_HEADER_INVALID');
  const references = new Set<string>();
  let payments = 0n;
  let refunds = 0n;
  const rows: NormalizedRow[] = [];
  for (const row of document.rows) {
    const reference = text(row.reference, 'STATEMENT_REFERENCE_REQUIRED');
    if (reference.length > 255) throw new Error('STATEMENT_REFERENCE_INVALID');
    if (references.has(reference)) throw new Error('STATEMENT_REFERENCE_DUPLICATE');
    references.add(reference);
    const amount = minor(row.amountMinor, false, 'STATEMENT_AMOUNT_INVALID');
    const tax = document.headers.length === legacyHeaders.length ? 0n : minor(row.taxMinor, true, 'STATEMENT_TAX_INVALID');
    if (tax > amount) throw new Error('STATEMENT_TAX_INVALID');
    if (row.currency !== 'CNY') throw new Error('STATEMENT_CURRENCY_UNSUPPORTED');
    const occurredAt = timestamp(row.occurredAt);
    if (row.type === 'payment') payments += amount;
    else if (row.type === 'refund') refunds += amount;
    else throw new Error('STATEMENT_TYPE_INVALID');
    if (payments > MAX_SAFE_MINOR || refunds > MAX_SAFE_MINOR) throw new Error('STATEMENT_TOTAL_OVERFLOW');
    rows.push(Object.freeze({ reference, type: row.type, amountMinor: amount.toString(), taxMinor: tax.toString(), currency: 'CNY', occurredAt }));
  }
  return Object.freeze({ rows: Object.freeze(rows), payments, refunds });
}

interface Source {
  readonly scope_id: string;
  readonly statement_hash: string;
  readonly provider: string;
  readonly object_ref: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly timezone: string;
}
interface NormalizedRow {
  readonly reference: string;
  readonly type: 'payment' | 'refund';
  readonly amountMinor: string;
  readonly taxMinor: string;
  readonly currency: 'CNY';
  readonly occurredAt: string;
}
interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
const MAX_SAFE_MINOR = 9_007_199_254_740_991n;
function minor(value: unknown, zero: boolean, code: string): bigint {
  if (typeof value !== 'string' || !(zero ? /^(?:0|[1-9]\d{0,15})$/ : /^[1-9]\d{0,15}$/).test(value)) throw new Error(code);
  const parsed = BigInt(value);
  if (parsed > MAX_SAFE_MINOR) throw new Error(code);
  return parsed;
}
function unsignedMinor(value: unknown, code: string): bigint {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) throw new Error(code);
  const parsed = BigInt(value);
  if (parsed > MAX_SAFE_MINOR) throw new Error(code);
  return parsed;
}
function signedMinor(value: bigint, code: string): bigint {
  if (value < -MAX_SAFE_MINOR || value > MAX_SAFE_MINOR) throw new Error(code);
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.test(value) || Number.isNaN(Date.parse(value)))
    throw new Error('STATEMENT_OCCURRED_AT_INVALID');
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (parsed.toISOString().slice(0, 10) !== date) throw new Error('STATEMENT_OCCURRED_AT_INVALID');
  return value;
}
function same(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
