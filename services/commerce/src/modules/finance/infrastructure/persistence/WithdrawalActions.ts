import type { FinanceAction, FinanceEntries } from './FinanceOperation';
import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
/** Withdrawal persistence actions. */
import { randomUUID } from 'node:crypto';

import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { rowResult } from '../../../../adapter/database/DatabaseResult';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/application/Validation';
import type { FinanceWorkflowFactory } from './PgFinanceWorkflow';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import { Withdrawal, type WithdrawalState } from '../../domain/model/Withdrawal';

const policy = new SettlementPolicy();

export function withdrawalActions(repository: FinanceWorkflowFactory): FinanceEntries<'withdrawalsCreate' | 'withdrawalsDecide' | 'withdrawalsRecover'> {
  return {
    withdrawalsCreate: create,
    withdrawalsDecide: (request, database) => decide(request, database, repository),
    withdrawalsRecover: (request, database) => recover(request, database, repository),
  };
}

const create: FinanceAction = async (request, database) => {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const amount = integerField(body, 'amountMinor', 1);
  const id = `withdrawal:${randomUUID()}`;
  const destinationRef = textField(body, 'destinationRef', 256);
  const source = await database.query<{ id: string; scope_id: string; amount_minor: number; currency: string; withdrawn_minor: number }>(
    `select settlement.id,settlement.scope_id,settlement.amount_minor::float8 amount_minor,settlement.currency,
    coalesce((select sum(withdrawal.amount_minor) from finance.withdrawal withdrawal where withdrawal.settlement_id=settlement.id
      and withdrawal.state not in('rejected','cancelled','failed')),0)::float8 withdrawn_minor
    from finance.settlement settlement where settlement.id=$1 and settlement.scope_id=$2 and settlement.state='payable' for update`,
    [body.settlement, access.scope.id]
  );
  const settlement = source.rows[0];
  if (!settlement) throw new Error('FINANCE_WITHDRAWAL_SETTLEMENT_NOT_PAYABLE');
  policy.assertWithdrawal(Number(settlement.amount_minor), Number(settlement.withdrawn_minor), amount);
  const proposal = Withdrawal.submit({ id, scopeId: settlement.scope_id, settlementId: settlement.id, amountMinor: amount,
    currency: settlement.currency, destinationRef, requestedBy: access.actor.id }).snapshot();
  const result = await database.query(
    `insert into finance.withdrawal(id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,
    requested_by,reason,evidence,created_at,updated_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,
    clock_timestamp(),clock_timestamp(),$11) returning *`,
    [proposal.id, proposal.scopeId, proposal.settlementId, proposal.amountMinor, proposal.currency, proposal.destinationRef,
      proposal.state, proposal.requestedBy, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), proposal.version]
  );
  if (!result.rows[0]) throw new Error('FINANCE_WITHDRAWAL_EXCEEDS_PAYABLE');
  return rowResult(result, 201);
};

async function decide(request: OperationRequest, database: SqlExecutor, repository: FinanceWorkflowFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
  if (!decision) throw new Error('FINANCE_WITHDRAWAL_DECISION_INVALID');
  const selected = await withdrawal(database, request.input.path.withdrawalid!, access.scope.id, true);
  if (!selected) throw new Error('FINANCE_WITHDRAWAL_CONFLICT_OR_SEPARATION');
  const current = model(selected);
  const target = current.decide(access.actor.id, decision === 'approved', policy).snapshot();
  const result = await database.query(
    `update finance.withdrawal set state=$2,approved_by=$3,evidence=evidence||$4::jsonb,updated_at=clock_timestamp(),version=$5
    where id=$1 and scope_id=$6 and state=$7 and version=$8 returning *`,
    [target.id, target.state, target.approvedBy, JSON.stringify({ decisionReason: textField(body, 'reason', 1000), decisionEvidence: record(body.evidence) }),
      target.version, access.scope.id, selected.state, selected.version]
  );
  if (!result.rows[0]) throw new Error('FINANCE_WITHDRAWAL_CONFLICT_OR_SEPARATION');
  if (decision === 'approved') await repository(database).enqueue('settlement', access.scope.id, { withdrawal: request.input.path.withdrawalid! }, `job:withdrawal:${request.input.path.withdrawalid!}`);
  return rowResult(result, decision === 'approved' ? 202 : 200);
}

async function recover(request: OperationRequest, database: SqlExecutor, repository: FinanceWorkflowFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const id = request.input.path.withdrawalid!;
  const selected = await withdrawal(database, id, access.scope.id, true);
  if (!selected) throw new Error('FINANCE_WITHDRAWAL_NOT_RECOVERABLE');
  const target = model(selected).recover().snapshot();
  const result = await database.query(
    `update finance.withdrawal set state='approved',evidence=evidence||$3::jsonb,
    updated_at=clock_timestamp(),version=$4 where id=$1 and scope_id=$2 and state=$5 and version=$6 returning *`,
    [id, access.scope.id, JSON.stringify({ recoveryReason: textField(body, 'reason', 1000), recoveryEvidence: record(body.evidence), recoveredBy: access.actor.id, trace: access.trace }),
      target.version, selected.state, selected.version]
  );
  if (!result.rows[0]) throw new Error('FINANCE_WITHDRAWAL_NOT_RECOVERABLE');
  await repository(database).enqueue('settlement', access.scope.id, { withdrawal: id }, `job:withdrawal:${id}`, true);
  return rowResult(result, 202);
}

interface WithdrawalRow {
  readonly id: string;
  readonly scope_id: string;
  readonly settlement_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly destination_ref: string;
  readonly state: WithdrawalState;
  readonly requested_by: string;
  readonly approved_by: string | null;
  readonly provider_reference: string | null;
  readonly version: number;
}

async function withdrawal(database: SqlExecutor, id: string, scope: string, lock: boolean): Promise<WithdrawalRow | null> {
  const result = await database.query<WithdrawalRow>(
    `select id,scope_id,settlement_id,amount_minor::float8 amount_minor,currency,destination_ref,state,requested_by,
    approved_by,provider_reference,version::float8 version from finance.withdrawal where id=$1 and scope_id=$2 ${lock ? 'for update' : ''}`,
    [id, scope]
  );
  return result.rows[0] ?? null;
}

function model(row: WithdrawalRow): Withdrawal {
  return Withdrawal.restore({ id: row.id, scopeId: row.scope_id, settlementId: row.settlement_id, amountMinor: Number(row.amount_minor),
    currency: row.currency, destinationRef: row.destination_ref, state: row.state, requestedBy: row.requested_by,
    approvedBy: row.approved_by, providerReference: row.provider_reference, version: Number(row.version) });
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}
