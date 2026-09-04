import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { createHash } from 'node:crypto';

import type { RepairDifference } from '../../domain/model/RepairCase';
import type { RepairDecisionContext, RepairRepository, RepairView } from '../../application/port/RepairRepository';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { RepairPolicy } from '../../domain/policy/RepairPolicy';

const projection = `repair.id,repair.statement_id "statementId",repair.status,repair.source_hash "sourceHash",
repair.source_journal_id "sourceJournalId",repair.source_journal_hash "sourceJournalHash",repair.preview_hash "previewHash",
repair.differences,repair.entries,repair.maker_id "makerId",repair.checker_id "checkerId",repair.approval_instance_id "approvalInstanceId",
repair.approval_amount_minor::float8 "approvalAmountMinor",repair.source_reversal_journal_id "sourceReversalJournalId",
repair.replacement_journal_id "replacementJournalId",repair.rollback_journal_id "rollbackJournalId",
repair.reason,repair.decision_reason "decisionReason",repair.reverse_reason "reverseReason",repair.reversed_by "reversedBy",
repair.decided_at "decidedAt",repair.reversed_at "reversedAt",repair.version::float8 version,repair.created_at "createdAt",repair.updated_at "updatedAt"`;

export class PgRepairRepository implements RepairRepository {
  constructor(
    private readonly database: SqlExecutor,
    private readonly policy: RepairPolicy
  ) {}

  async read(scopeIds: readonly string[], status: string | null, statementId: string | null, cursor: string | null, limit: number): Promise<readonly RepairView[]> {
    const result = await this.database.query<RepairView>(
      `select ${projection} from finance.repair repair where repair.scope_id=any($1::text[])
      and ($2::text is null or repair.status=$2) and ($3::text is null or repair.statement_id=$3)
      and ($4::text is null or repair.id>$4) order by repair.id limit $5`,
      [scopeIds, status, statementId, cursor, limit]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async statement(scopeId: string, statementId: string) {
    const result = await this.database.query<{ id: string; hash: string; version: number; debit_minor: number; credit_minor: number; currency: string; period_start: string; period_end: string }>(
      `select id,coalesce(sha256,encode(public.digest(id||':'||debit_minor||':'||credit_minor||':'||closing_minor,'sha256'),'hex')) hash,
      version::float8 version,debit_minor::float8 debit_minor,credit_minor::float8 credit_minor,currency,period_start::text,period_end::text from finance.statement
      where id=$1 and scope_id=$2 and state in('draft','final') for share`,
      [statementId, scopeId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const difference = Object.freeze({
      id: `reconciliationdifference:${digest(`${row.id}:balance`)}`,
      kind: 'statementbalance',
      expectedMinor: row.credit_minor,
      actualMinor: row.debit_minor,
      deltaMinor: row.debit_minor - row.credit_minor,
      currency: row.currency,
    });
    return Object.freeze({ id: row.id, hash: row.hash, version: row.version, currency: row.currency, periodStart: row.period_start, periodEnd: row.period_end, differences: Object.freeze([difference]) });
  }

  async sourceJournal(scopeId: string, journalId: string, periodStart: string, periodEnd: string, currency: string) {
    const result = await this.database.query<{ id: string; hash: string; debit_minor: number }>(
      `select journal.id,finance.journal_hash(journal.id,$2) hash,
        coalesce(sum(entry.amount_minor) filter(where entry.side='debit'),0)::float8 debit_minor
       from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
       where journal.id=$1 and journal.scope_id=$2 and journal.state='posted' and journal.currency=$5
         and journal.posted_at::date between $3::date and $4::date
       group by journal.id having count(entry.id)>=2`,
      [journalId, scopeId, periodStart, periodEnd, currency]
    );
    const row = result.rows[0];
    return row && row.debit_minor > 0 ? Object.freeze({ id: row.id, hash: row.hash, debitMinor: row.debit_minor }) : null;
  }

  async submit(input: Parameters<RepairRepository['submit']>[0]): Promise<RepairView | null> {
    const proposal = input.proposal;
    const result = await this.database.query<RepairView>(
      `with created as (
        insert into finance.repair(id,scope_id,statement_id,status,source_hash,source_version,preview_hash,differences,
          entries,maker_id,checker_id,reason,source_journal_id,source_journal_hash,source_journal_debit_minor,
          approval_instance_id,approval_amount_minor,version,created_at,updated_at)
        select $1,$2,$3,'submitted',$4,$5,$6,$7::jsonb,$8::jsonb,$9,null,$10,$11,$12,$13,$14,$15,1,clock_timestamp(),clock_timestamp()
        from finance.statement statement join finance.journal journal on journal.id=$11 and journal.scope_id=$2 and journal.state='posted'
        where statement.id=$3 and statement.scope_id=$2 and statement.version=$5
          and coalesce(statement.sha256,encode(public.digest(statement.id||':'||statement.debit_minor||':'||statement.credit_minor||':'||statement.closing_minor,'sha256'),'hex'))=$4
          and finance.journal_hash(journal.id,$2)=$12 and journal.currency=statement.currency
          and journal.posted_at::date between statement.period_start and statement.period_end
        on conflict(scope_id,statement_id,preview_hash) do nothing returning *
      ) select ${projection} from created repair`,
      [input.id, proposal.scopeId, proposal.statementId, proposal.sourceHash, proposal.sourceVersion, input.previewHash,
        JSON.stringify(proposal.differences), JSON.stringify(proposal.entries), proposal.makerId, proposal.reason,
        proposal.sourceJournalId, proposal.sourceJournalHash, proposal.sourceJournalDebitMinor, input.approvalInstanceId, input.approvalAmountMinor]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async decide(input: Parameters<RepairRepository['decide']>[0]) {
    const current = await this.lock(input.id, input.scopeId);
    if (current.status !== 'submitted') throw new DomainError('FINANCE_REPAIR_ALREADY_DECIDED');
    this.policy.assertDecision(current.makerId, input.checkerId);
    if (current.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    if (input.decision === 'approved') {
      if (!input.proofId) throw new DomainError('APPROVAL_PROOF_INVALID');
      await this.database.query(`select finance.approve_repair($1,$2,$3,$4,$5,$6)`, [input.id, input.scopeId, input.checkerId, input.expectedVersion, input.reason, input.proofId]);
      const result = await this.database.query<RepairView>(`select ${projection} from finance.repair repair where repair.id=$1 and repair.scope_id=$2`, [input.id, input.scopeId]);
      return result.rows[0] ? Object.freeze(result.rows[0]) : null;
    }
    await this.database.query(`select finance.reject_repair($1,$2,$3,$4,$5)`, [input.id, input.scopeId, input.checkerId, input.expectedVersion, input.reason]);
    const result = await this.database.query<RepairView>(`select ${projection} from finance.repair repair where repair.id=$1 and repair.scope_id=$2`, [input.id, input.scopeId]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async reverse(input: Parameters<RepairRepository['reverse']>[0]) {
    const current = await this.lock(input.id, input.scopeId);
    if (current.status !== 'approved') throw new DomainError(current.status === 'reversed' ? 'FINANCE_REPAIR_ALREADY_DECIDED' : 'FINANCE_REPAIR_CONFLICT');
    this.policy.assertDecision(current.makerId, input.checkerId);
    this.policy.assertReversible(current.status, current.sourceReversalJournalId, current.replacementJournalId, current.rollbackJournalId);
    if (current.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    await this.database.query(`select finance.reverse_repair($1,$2,$3,$4,$5)`, [input.id, input.scopeId, input.checkerId, input.expectedVersion, input.reason]);
    const result = await this.database.query<RepairView>(`select ${projection} from finance.repair repair where repair.id=$1 and repair.scope_id=$2`, [input.id, input.scopeId]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async lock(id: string, scopeId: string): Promise<RepairDecisionContext> {
    const result = await this.database.query<RepairDecisionContext>(
      `select id,scope_id "scopeId",status,maker_id "makerId",version::float8 version,statement_id "statementId",
        source_hash "sourceHash",source_version::float8 "sourceVersion",source_journal_id "sourceJournalId",
        source_journal_hash "sourceJournalHash",preview_hash "previewHash",approval_instance_id "approvalInstanceId",
        approval_amount_minor::float8 "approvalAmountMinor",source_reversal_journal_id "sourceReversalJournalId",
        replacement_journal_id "replacementJournalId",rollback_journal_id "rollbackJournalId"
       from finance.repair where id=$1 and scope_id=$2 for update`,
      [id, scopeId]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('FINANCE_REPAIR_CONFLICT');
    return row;
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
