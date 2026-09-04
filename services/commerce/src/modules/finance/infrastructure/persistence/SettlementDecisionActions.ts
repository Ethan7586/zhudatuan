import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { rowResult } from '../../../../adapter/database/DatabaseResult';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import type { FinanceEntries } from './FinanceOperation';
import { PgAccountingPort } from './PgAccountingPort';
import { financeEvidence } from './FinanceEvidence';
import type { FinanceWorkflowFactory } from './PgFinanceWorkflow';

const policy = new SettlementPolicy();
const finance = new PgAccountingPort();

export function settlementDecisionActions(workflow: FinanceWorkflowFactory): FinanceEntries<'settlementsDecide'> {
  return { settlementsDecide: (request, database) => decide(request, database, workflow) };
}

async function decide(request: OperationRequest, database: SqlExecutor, workflow: FinanceWorkflowFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const approved = body.decision === 'approved';
  if (!approved && body.decision !== 'rejected') throw new Error('FINANCE_SETTLEMENT_DECISION_INVALID');
  const settlement = await database.query<Settlement>(
    `select id,scope_id,partner_id,amount_minor::float8 amount_minor,
    gross_minor::float8 gross_minor,fee_minor::float8 fee_minor,currency,requested_by from finance.settlement
    where id=$1 and scope_id=$2 and state='draft' and requested_by<>$3 for update`,
    [request.input.path.settlementid!, access.scope.id, access.actor.id]
  );
  const selected = settlement.rows[0];
  if (!selected) throw new Error('FINANCE_SETTLEMENT_CONFLICT_OR_SEPARATION');
  policy.assertDecision(selected.requested_by, access.actor.id, selected.amount_minor);
  if (approved) await postSettlement(database, selected);
  const result = await database.query(
    `update finance.settlement set state=$2,approved_by=case when $2='payable' then $3 else null end,
    approved_at=case when $2='payable' then clock_timestamp() else null end,evidence=evidence||$4::jsonb,version=version+1 where id=$1 returning *`,
    [selected.id, approved ? 'payable' : 'cancelled', access.actor.id, JSON.stringify({ reason: textField(body, 'reason', 1000), evidence: financeEvidence(body.evidence) })]
  );
  if (approved) {
    await database.query(`update finance.split set state='paid' where settlement_id=$1 and beneficiary_type='platform' and state='frozen'`, [selected.id]);
    await workflow(database).event('finance.settlement.approved', 'settlement', selected.id, selected.scope_id, {
      settlement: selected.id, partner: selected.partner_id, amountMinor: selected.amount_minor,
      grossMinor: selected.gross_minor, feeMinor: selected.fee_minor, currency: selected.currency,
    });
  }
  return rowResult(result);
}

async function postSettlement(database: SqlExecutor, selected: Settlement): Promise<void> {
  await finance.post(requireWriteTransaction(database.transaction), {
    scopeId: selected.scope_id, source: { module: 'finance', aggregate: 'settlement', aggregateId: `${selected.id}:partner`, event: 'finance.settlement.approved', eventId: selected.id, leg: 'partner' },
    currency: selected.currency, description: 'Settlement liability accrual', debit: { code: 'settlement.cost', kind: 'expense' },
    credit: { code: `settlement.payable.${selected.partner_id}`, kind: 'liability' }, amountMinor: selected.amount_minor,
  });
  if (selected.fee_minor > 0) await finance.post(requireWriteTransaction(database.transaction), {
    scopeId: selected.scope_id, source: { module: 'finance', aggregate: 'settlement', aggregateId: `${selected.id}:platform`, event: 'finance.settlement.approved', eventId: selected.id, leg: 'platform' },
    currency: selected.currency, description: 'Settlement platform fee', debit: { code: 'settlement.cost', kind: 'expense' },
    credit: { code: 'platform.fee', kind: 'income' }, amountMinor: selected.fee_minor,
  });
}

interface Settlement {
  readonly id: string;
  readonly scope_id: string;
  readonly partner_id: string;
  readonly amount_minor: number;
  readonly gross_minor: number;
  readonly fee_minor: number;
  readonly currency: string;
  readonly requested_by: string;
}
