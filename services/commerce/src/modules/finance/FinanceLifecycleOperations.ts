import { randomUUID } from 'node:crypto';
import type { OperationActions, OperationDatabase } from '../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';

export function financeLifecycleOperations(): OperationActions {
  return {
    'finance.reconciliations.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
<<<<<<< HEAD
      const q = queryText(request.input.query, 'q', 200);
      const period = queryPeriod(request.input.query);
      const provider = queryText(request.input.query, 'channel', 64);
      const scope = queryText(request.input.query, 'mall', 200);
      const state = queryChoice(request.input.query, 'status', ['received', 'matching', 'balanced', 'difference', 'pending-review', 'resolved', 'approved'] as const);
      const difference = queryText(request.input.query, 'difference', 100);
      const kind = queryChoice(request.input.query, 'kind', ['payment', 'refund'] as const);
      const result = await database.query(
        `select reconciliation.*,
        coalesce((select jsonb_object_agg(state,count) from (select state,count(*) count from finance.reconciliationitem item
          where item.reconciliation_id=reconciliation.id group by state) states),'{}'::jsonb) item_counts,
        coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'externalMinor',item.external_minor,'internalMinor',item.internal_minor,
          'differenceMinor',item.difference_minor,'kind',item.kind,'internalType',item.internal_type,'internalId',item.internal_id,
          'statementLineId',item.statement_line_id,'state',item.state,'reasonCode',item.reason_code,'evidence',item.evidence,
          'resolution',item.resolution,'resolvedBy',item.resolved_by,'approvedBy',item.approved_by,'version',item.version) order by item.id)
          from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id),'[]'::jsonb) items
        from finance.reconciliation reconciliation where access.scope_allowed(reconciliation.scope_id)
        and reconciliation.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::text is null or reconciliation.id>$2)
        and ($4::text is null or position(lower($4) in lower(concat_ws(' ',reconciliation.id,reconciliation.statement_ref,
          reconciliation.partner_id,reconciliation.provider)))>0 or exists(select 1 from finance.reconciliationitem item
            left join finance.statementline line on line.id=item.statement_line_id where item.reconciliation_id=reconciliation.id
            and position(lower($4) in lower(concat_ws(' ',item.id,item.internal_id,line.external_reference)))>0))
        and ($5::text is null or reconciliation.period=$5)
        and ($6::text is null or reconciliation.provider=$6)
        and ($7::text is null or reconciliation.scope_id=$7)
        and ($8::text is null or reconciliation.state=$8 or ($8='pending-review' and exists(
          select 1 from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id
            and item.state='resolutionpending')))
        and ($9::text is null or ($9='none' and not exists(select 1 from finance.reconciliationitem item
              where item.reconciliation_id=reconciliation.id and item.state<>'matched'))
          or exists(select 1 from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id
            and item.reason_code=$9))
        and ($10::text is null or exists(select 1 from finance.reconciliationitem item
          where item.reconciliation_id=reconciliation.id and item.kind=$10))
        order by reconciliation.id limit $3`,
        [access.scope.id, page.id, page.fetch, q, period, provider, scope, state, difference, kind]
      );
      const facetResult = await database.query<{ facets: unknown }>(
        `with allowed as(
          select reconciliation.* from finance.reconciliation reconciliation
          where access.scope_allowed(reconciliation.scope_id) and reconciliation.scope_id in(
            select descendant_id from organization.unitclosure where ancestor_id=$1)
        ), periods as(select coalesce(jsonb_agg(jsonb_build_object('value',value,'label',replace(value,'/',' 至 '),'count',count)
            order by value desc),'[]'::jsonb) value from(select period value,least(count(*),2147483647)::integer count
              from allowed group by period) grouped),
        channels as(select coalesce(jsonb_agg(jsonb_build_object('value',value,'label',value,'count',count)
            order by value),'[]'::jsonb) value from(select provider value,least(count(*),2147483647)::integer count
              from allowed group by provider) grouped),
        malls as(select coalesce(jsonb_agg(jsonb_build_object('value',value,'label',label,'count',count)
            order by label),'[]'::jsonb) value from(select allowed.scope_id value,max(organization.name) label,
              least(count(*),2147483647)::integer count from allowed join organization.organization organization
              on organization.id=allowed.scope_id group by allowed.scope_id) grouped),
        statuses as(select coalesce(jsonb_agg(jsonb_build_object('value',value,'label',value,'count',count)
            order by value),'[]'::jsonb) value from(select state value,least(count(*),2147483647)::integer count
              from allowed group by state) grouped),
        differences as(select coalesce(jsonb_agg(jsonb_build_object('value',value,'label',value,'count',count)
            order by value),'[]'::jsonb) value from(select coalesce(item.reason_code,'none') value,
              least(count(distinct allowed.id),2147483647)::integer count from allowed
              left join finance.reconciliationitem item on item.reconciliation_id=allowed.id
                and item.state<>'matched' group by coalesce(item.reason_code,'none')) grouped)
        select jsonb_build_object('periods',periods.value,'channels',channels.value,'malls',malls.value,
          'statuses',statuses.value,'differenceTypes',differences.value) facets
        from periods cross join channels cross join malls cross join statuses cross join differences`,
        [access.scope.id]
      );
      const response = keysetResult(result, page, 'id');
      return {
        ...response,
        body: {
          ...(response.body as Readonly<Record<string, unknown>>),
          facets: facetResult.rows[0]?.facets ?? {
            periods: [],
            channels: [],
            malls: [],
            statuses: [],
            differenceTypes: [],
          },
        },
      };
=======
      const result = await database.query(`select reconciliation.*,
        coalesce((select jsonb_object_agg(state,count) from (select state,count(*) count from finance.reconciliationitem item
          where item.reconciliation_id=reconciliation.id group by state) states),'{}'::jsonb) item_counts,
        coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'externalMinor',item.external_minor,'internalMinor',item.internal_minor,
          'differenceMinor',item.difference_minor,'state',item.state,'reasonCode',item.reason_code,'evidence',item.evidence,
          'resolution',item.resolution,'resolvedBy',item.resolved_by,'approvedBy',item.approved_by) order by item.id)
          from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id),'[]'::jsonb) items
        from finance.reconciliation reconciliation where access.scope_allowed(reconciliation.scope_id)
        and reconciliation.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::text is null or reconciliation.id>$2) order by reconciliation.id limit $3`, [access.scope.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    },
    'finance.settlements.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
<<<<<<< HEAD
      const result = await database.query(
        `select settlement.*,
=======
      const result = await database.query(`select settlement.*,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        coalesce((select jsonb_agg(jsonb_build_object('id',line.id,'sourceType',line.source_type,'sourceId',line.source_id,
          'amountMinor',line.amount_minor,'taxMinor',line.tax_minor,'state',line.state,'adjustmentOf',line.adjustment_of) order by line.id)
          from finance.settlementline line where line.settlement_id=settlement.id),'[]'::jsonb) lines
        ,coalesce((select jsonb_agg(jsonb_build_object('id',split.id,'beneficiaryType',split.beneficiary_type,
          'beneficiaryId',split.beneficiary_id,'amountMinor',split.amount_minor,'basisPoints',split.basis_points,'state',split.state) order by split.id)
          from finance.split split where split.settlement_id=settlement.id),'[]'::jsonb) splits
        ,coalesce((select jsonb_agg(jsonb_build_object('id',adjustment.id,'line',adjustment.settlement_line_id,
          'direction',adjustment.direction,'amountMinor',adjustment.amount_minor,'taxMinor',adjustment.tax_minor,'state',adjustment.state,
          'requestedBy',adjustment.requested_by,'approvedBy',adjustment.approved_by,'reason',adjustment.reason,'evidence',adjustment.evidence)
          order by adjustment.created_at,adjustment.id) from finance.settlementadjustment adjustment
          where adjustment.settlement_id=settlement.id),'[]'::jsonb) adjustments
        from finance.settlement settlement where access.scope_allowed(settlement.scope_id)
        and settlement.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
<<<<<<< HEAD
        and ($2::text is null or settlement.id>$2) order by settlement.id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
=======
        and ($2::text is null or settlement.id>$2) order by settlement.id limit $3`, [access.scope.id, page.id, page.fetch]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      return keysetResult(result, page, 'id');
    },
    'finance.withdrawals.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
<<<<<<< HEAD
      const result = await database.query(
        `select withdrawal.* from finance.withdrawal withdrawal where access.scope_allowed(withdrawal.scope_id)
        and withdrawal.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::timestamptz is null or (withdrawal.created_at,withdrawal.id)<($2::timestamptz,$3))
        order by withdrawal.created_at desc,withdrawal.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
=======
      const result = await database.query(`select withdrawal.* from finance.withdrawal withdrawal where access.scope_allowed(withdrawal.scope_id)
        and withdrawal.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::timestamptz is null or (withdrawal.created_at,withdrawal.id)<($2::timestamptz,$3))
        order by withdrawal.created_at desc,withdrawal.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      return keysetResult(result, page, 'created_at');
    },
    'finance.holds.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
<<<<<<< HEAD
      const result = await database.query(
        `select hold.*,account.code,account.currency from finance.hold hold join finance.account account on account.id=hold.account_id
        where access.scope_allowed(hold.scope_id) and hold.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::timestamptz is null or (hold.created_at,hold.id)<($2::timestamptz,$3))
        order by hold.created_at desc,hold.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
=======
      const result = await database.query(`select hold.*,account.code,account.currency from finance.hold hold join finance.account account on account.id=hold.account_id
        where access.scope_allowed(hold.scope_id) and hold.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::timestamptz is null or (hold.created_at,hold.id)<($2::timestamptz,$3))
        order by hold.created_at desc,hold.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      return keysetResult(result, page, 'created_at');
    },
    'finance.periods.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
<<<<<<< HEAD
      const result = await database.query(
        `select period.scope_id,period.period,period.state,period.closed_at,period.closed_by,
        period.ledger_id,period.legal_timezone,period.period_start_at,period.period_end_at,
        close.id close_id,close.state close_state,close.source_hash,close.requested_by,close.approved_by,close.reason,close.evidence,
        statement.opening_debit_minor,statement.opening_credit_minor,statement.debit_minor,statement.credit_minor,
        statement.closing_debit_minor,statement.closing_credit_minor,statement.account_count,statement.balanced,
        statement.source_hash statement_source_hash,statement.watermark,statement.state statement_state
        from finance.period period
        left join finance.periodclose close on close.scope_id=period.scope_id and close.period=period.period
        left join finance.statement statement on statement.scope_id=period.scope_id
          and to_char(statement.period_start,'YYYY-MM')=period.period and statement.currency='CNY'
          and statement.calculation_version=2 and statement.state in('draft','final')
        where period.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::text is null or period.scope_id||':'||period.period>$2) order by period.scope_id,period.period limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
=======
      const result = await database.query(`select period.scope_id,period.period,period.state,period.closed_at,period.closed_by,
        close.id close_id,close.state close_state,close.source_hash,close.requested_by,close.approved_by,close.reason,close.evidence,
        statement.debit_minor,statement.credit_minor,statement.state statement_state from finance.period period
        left join finance.periodclose close on close.scope_id=period.scope_id and close.period=period.period
        left join finance.statement statement on statement.scope_id=period.scope_id
          and to_char(statement.period_start,'YYYY-MM')=period.period and statement.currency='CNY'
        where period.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::text is null or period.scope_id||':'||period.period>$2) order by period.scope_id,period.period limit $3`,
      [access.scope.id, page.id, page.fetch]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      return keysetResult(result, page, 'period');
    },
    'finance.periods.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const period = request.input.path.period!;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('FINANCE_PERIOD_INVALID');
      const action = textField(body, 'action', 20);
      if (action === 'request') {
<<<<<<< HEAD
        const refreshed = await database.query<{ statement: string }>(`select finance.refresh_trial_balance($1,'CNY',$2,false) statement`, [access.scope.id, period]);
        if (!refreshed.rows[0]?.statement) throw new Error('FINANCE_TRIAL_BALANCE_REFRESH_FAILED');
        const result = await database.query(
          `with control as(select * from finance.period_control($1,'CNY',$2)),
          created as(insert into finance.periodclose(id,scope_id,period,state,source_hash,requested_by,reason,evidence,requested_at,version)
            select 'periodclose:'||encode(public.digest($1||':'||$2,'sha256'),'hex'),period.scope_id,period.period,'pending',
              control.source_hash,$3,$4,$5::jsonb||jsonb_build_object('controls',jsonb_build_object(
                'statement',control.statement_id,'sourceHash',control.source_hash,'subledgerConsistent',control.subledger_consistent,
                'unresolvedDifferences',control.unresolved_differences,'unpostedJournals',control.unposted_journals,
                'uncertainPayouts',control.uncertain_payouts,'unprocessedFinanceEvents',control.unprocessed_finance_events,
                'incompleteFinanceJobs',control.incomplete_finance_jobs,
                'unsettledApprovedReconciliations',control.unsettled_approved_reconciliations,
                'missingSettlementJournals',control.missing_settlement_journals,'periodEndAt',control.period_end_at,
                'closeEligibleAt',control.close_eligible_at,'cutoffReached',control.cutoff_reached)),clock_timestamp(),0
              from finance.period period cross join control
              where period.scope_id=$1 and period.period=$2 and period.state='open' and control.ready
              and ($6::bigint=0 or exists(select 1 from finance.periodclose existing where existing.scope_id=$1 and existing.period=$2
                and existing.state='rejected' and existing.version=$6))
            on conflict(scope_id,period) do update set state='pending',source_hash=excluded.source_hash,requested_by=excluded.requested_by,
              approved_by=null,reason=excluded.reason,evidence=excluded.evidence,requested_at=clock_timestamp(),decided_at=null,version=finance.periodclose.version+1
              where finance.periodclose.state='rejected' and finance.periodclose.version=$6 returning *) select * from created`,
          [access.scope.id, period, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), request.input.expectedVersion!]
        );
=======
        const result = await database.query(`with current as(select encode(public.digest(coalesce(string_agg(journal.id||':'||entry.id||':'||entry.amount_minor,
            ',' order by journal.id,entry.id),''),'sha256'),'hex') hash from finance.journal journal
            join finance.entry entry on entry.journal_id=journal.id where journal.scope_id=$1 and journal.period=$2),
          created as(insert into finance.periodclose(id,scope_id,period,state,source_hash,requested_by,reason,evidence,requested_at,version)
            select 'periodclose:'||encode(public.digest($1||':'||$2,'sha256'),'hex'),period.scope_id,period.period,'pending',current.hash,$3,$4,$5::jsonb,
              clock_timestamp(),0 from finance.period period cross join current where period.scope_id=$1 and period.period=$2 and period.state='open'
              and exists(select 1 from finance.statement where scope_id=$1 and to_char(period_start,'YYYY-MM')=$2 and state='draft')
            on conflict(scope_id,period) do update set state='pending',source_hash=excluded.source_hash,requested_by=excluded.requested_by,
              approved_by=null,reason=excluded.reason,evidence=excluded.evidence,requested_at=clock_timestamp(),decided_at=null,version=finance.periodclose.version+1
              where finance.periodclose.state='rejected' returning *) select * from created`,
        [access.scope.id, period, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence))]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        if (!result.rows[0]) throw new Error('FINANCE_PERIOD_CLOSE_NOT_REQUESTABLE');
        await database.query(`update finance.period set state='closing' where scope_id=$1 and period=$2 and state='open'`, [access.scope.id, period]);
        return rowResult(result, 201);
      }
      const decision = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
      if (!decision) throw new Error('FINANCE_PERIOD_ACTION_INVALID');
<<<<<<< HEAD
      const result = await database.query(
        `with control as(select * from finance.period_control($1,'CNY',$2))
        update finance.periodclose close set state=$3,approved_by=$4,decided_at=clock_timestamp(),reason=$5,evidence=evidence||$6::jsonb,
          version=version+1 from control where close.scope_id=$1 and close.period=$2 and close.state='pending' and close.requested_by<>$4
          and close.version=$7 and ($3='rejected' or (control.ready and close.source_hash=control.current_hash))
          returning close.*`,
        [access.scope.id, period, decision, access.actor.id, textField(body, 'reason', 1000), JSON.stringify({ decisionEvidence: record(body.evidence), trace: access.trace }), request.input.expectedVersion!]
      );
      const close = result.rows[0] as { id?: string; source_hash?: string } | undefined;
      if (!close?.id) throw new Error('FINANCE_PERIOD_CLOSE_CONFLICT_OR_HASH_MISMATCH');
      if (decision === 'approved') {
        const closed = await database.query(
          `update finance.period set state='closed',closed_at=clock_timestamp(),closed_by=$3
          where scope_id=$1 and period=$2 and state='closing'`,
          [access.scope.id, period, access.actor.id]
        );
        if (closed.rowCount !== 1) throw new Error('FINANCE_PERIOD_STATE_CONFLICT');
        const statement = await database.query<{
          id: string;
          period_start: string;
          period_end: string;
          currency: string;
          opening_debit_minor: string;
          opening_credit_minor: string;
          debit_minor: string;
          credit_minor: string;
          closing_debit_minor: string;
          closing_credit_minor: string;
          account_count: string;
          state: string;
        }>(
          `update finance.statement set state='final',generated_at=clock_timestamp()
          where scope_id=$1 and to_char(period_start,'YYYY-MM')=$2 and state='draft'
            and calculation_version=2 and balanced and source_hash=$3
          returning id,period_start,period_end,currency,opening_debit_minor::text,opening_credit_minor::text,
            debit_minor::text,credit_minor::text,closing_debit_minor::text,closing_credit_minor::text,
            account_count::text,state`,
          [access.scope.id, period, close.source_hash]
        );
        const snapshot = statement.rows[0];
        if (!snapshot) throw new Error('FINANCE_STATEMENT_FINALIZATION_FAILED');
        await event(database, 'finance.period.closed', 'periodclose', close.id, access.scope.id, {
          period,
          close: close.id,
          sourceHash: close.source_hash,
          statementSnapshot: {
            statement: snapshot.id,
            periodStart: snapshot.period_start,
            periodEnd: snapshot.period_end,
            currency: snapshot.currency,
            openingDebitMinor: snapshot.opening_debit_minor,
            openingCreditMinor: snapshot.opening_credit_minor,
            debitMinor: snapshot.debit_minor,
            creditMinor: snapshot.credit_minor,
            closingDebitMinor: snapshot.closing_debit_minor,
            closingCreditMinor: snapshot.closing_credit_minor,
            accountCount: snapshot.account_count,
            state: snapshot.state,
          },
        });
=======
      const result = await database.query(`with current as(select encode(public.digest(coalesce(string_agg(journal.id||':'||entry.id||':'||entry.amount_minor,
          ',' order by journal.id,entry.id),''),'sha256'),'hex') hash from finance.journal journal
          join finance.entry entry on entry.journal_id=journal.id where journal.scope_id=$1 and journal.period=$2)
        update finance.periodclose close set state=$3,approved_by=$4,decided_at=clock_timestamp(),reason=$5,evidence=evidence||$6::jsonb,
          version=version+1 from current where close.scope_id=$1 and close.period=$2 and close.state='pending' and close.requested_by<>$4
          and close.source_hash=current.hash returning close.*`,
      [access.scope.id, period, decision, access.actor.id, textField(body, 'reason', 1000),
        JSON.stringify({ decisionEvidence: record(body.evidence), trace: access.trace })]);
      const close = result.rows[0] as { id?: string } | undefined;
      if (!close?.id) throw new Error('FINANCE_PERIOD_CLOSE_CONFLICT_OR_HASH_MISMATCH');
      if (decision === 'approved') {
        await database.query(`update finance.period set state='closed',closed_at=clock_timestamp(),closed_by=$3
          where scope_id=$1 and period=$2 and state='closing'`, [access.scope.id, period, access.actor.id]);
        const statement = await database.query<{ id: string; period_start: string; period_end: string; currency: string; opening_minor: number;
          debit_minor: number; credit_minor: number; closing_minor: number; state: string }>(`update finance.statement set state='final',
          generated_at=clock_timestamp() where scope_id=$1 and to_char(period_start,'YYYY-MM')=$2 and state='draft'
          returning id,period_start,period_end,currency,opening_minor::float8 opening_minor,debit_minor::float8 debit_minor,
          credit_minor::float8 credit_minor,closing_minor::float8 closing_minor,state`, [access.scope.id, period]);
        const snapshot = statement.rows[0];
        if (!snapshot) throw new Error('FINANCE_STATEMENT_FINALIZATION_FAILED');
        await event(database, 'finance.period.closed', 'periodclose', close.id, access.scope.id,
          { period, close: close.id, sourceHash: (close as { source_hash?: string }).source_hash, statementSnapshot: {
            statement: snapshot.id, periodStart: snapshot.period_start, periodEnd: snapshot.period_end, currency: snapshot.currency,
            openingMinor: snapshot.opening_minor, debitMinor: snapshot.debit_minor, creditMinor: snapshot.credit_minor,
            closingMinor: snapshot.closing_minor, state: snapshot.state,
          } });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      } else await database.query(`update finance.period set state='open' where scope_id=$1 and period=$2 and state='closing'`, [access.scope.id, period]);
      return rowResult(result);
    },
    'finance.backfills.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
<<<<<<< HEAD
      const result = await database.query(
        `select * from finance.backfill where access.scope_allowed(scope_id)
        and scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::timestamptz is null or (prepared_at,id)<($2::timestamptz,$3)) order by prepared_at desc,id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
=======
      const result = await database.query(`select * from finance.backfill where access.scope_allowed(scope_id)
        and scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
        and ($2::timestamptz is null or (prepared_at,id)<($2::timestamptz,$3)) order by prepared_at desc,id desc limit $4`,
      [access.scope.id, page.sort, page.id, page.fetch]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      return keysetResult(result, page, 'prepared_at');
    },
    'finance.backfills.decide': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
      if (!decision) throw new Error('FINANCE_BACKFILL_DECISION_INVALID');
<<<<<<< HEAD
      const result = await database.query(
        `update finance.backfill set state=$2,signed_by=$3,signed_at=clock_timestamp(),
        evidence=evidence||$4::jsonb,version=version+1 where id=$1 and state='pending' and prepared_by<>$3 and source_hash=target_hash
        and source_count=target_count and source_minor=target_minor and version=$5 returning *`,
        [request.input.path.backfillid!, decision, access.actor.id, JSON.stringify({ reason: textField(body, 'reason', 1000), evidence: record(body.evidence) }), request.input.expectedVersion!]
      );
=======
      const result = await database.query(`update finance.backfill set state=$2,signed_by=$3,signed_at=clock_timestamp(),
        evidence=evidence||$4::jsonb where id=$1 and state='pending' and prepared_by<>$3 and source_hash=target_hash
        and source_count=target_count and source_minor=target_minor returning *`, [request.input.path.backfillid!, decision, access.actor.id,
        JSON.stringify({ reason: textField(body, 'reason', 1000), evidence: record(body.evidence) })]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      if (!result.rows[0]) throw new Error('FINANCE_BACKFILL_CONFLICT_OR_MISMATCH');
      return rowResult(result);
    },
  };
}

async function event(database: OperationDatabase, type: string, aggregateType: string, aggregate: string, scope: string, payload: unknown) {
<<<<<<< HEAD
  await database.query(
    `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values($1,$2,1,$3,$4,$5,$6::jsonb,$1,clock_timestamp(),clock_timestamp())`,
    [`event:${randomUUID()}`, type, aggregateType, aggregate, scope, JSON.stringify(payload)]
  );
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}

function queryText(query: Readonly<Record<string, unknown>>, field: string, maximum: number): string | null {
  const raw = query[field];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum) {
    throw new Error(`VALIDATION_FAILED:${field}`);
  }
  return value.trim();
}

function queryPeriod(query: Readonly<Record<string, unknown>>): string | null {
  const value = queryText(query, 'period', 21);
  if (value === null) return null;
  const match = /^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\/(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/.exec(value);
  if (!match || !canonicalDate(match[1]!) || !canonicalDate(match[2]!) || match[1]! > match[2]!) {
    throw new Error('FINANCE_QUERY_PERIOD_INVALID');
  }
  return value;
}

function canonicalDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function queryChoice<const T extends readonly string[]>(query: Readonly<Record<string, unknown>>, field: string, choices: T): T[number] | null {
  const value = queryText(query, field, 64);
  if (value === null) return null;
  if (!choices.includes(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  return value as T[number];
=======
  await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values($1,$2,1,$3,$4,$5,$6::jsonb,$1,clock_timestamp(),clock_timestamp())`,
  [`event:${randomUUID()}`, type, aggregateType, aggregate, scope, JSON.stringify(payload)]);
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}
