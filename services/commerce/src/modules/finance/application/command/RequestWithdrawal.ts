import { randomUUID } from 'node:crypto';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import type { FinanceRepositoryFactory } from '../port/FinanceRepository';

export function requestWithdrawalOperations(repository: FinanceRepositoryFactory): OperationActions {
  return {
    'finance.withdrawals.create': create,
    'finance.withdrawals.decide': (request, database) => decide(request, database, repository),
    'finance.withdrawals.recover': (request, database) => recover(request, database, repository),
  };
}

const create: NonNullable<OperationActions['finance.withdrawals.create']> = async (request, database) => {
<<<<<<< HEAD
<<<<<<< HEAD
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const amount = integerField(body, 'amountMinor', 1);
  const id = `withdrawal:${randomUUID()}`;
  const result = await database.query(
    `insert into finance.withdrawal(id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,
    requested_by,reason,evidence,created_at,updated_at,version) select $1,settlement.scope_id,settlement.id,$2,settlement.currency,$3,'submitted',
    $4,$5,$6::jsonb,clock_timestamp(),clock_timestamp(),0 from finance.settlement settlement where settlement.id=$7 and settlement.scope_id=$8
    and settlement.state='payable' and settlement.amount_minor-coalesce((select sum(withdrawal.amount_minor) from finance.withdrawal withdrawal
      where withdrawal.settlement_id=settlement.id and withdrawal.state not in('rejected','cancelled','failed')),0)>=$2
    and settlement.version=$9 returning *`,
    [id, amount, textField(body, 'destinationRef', 500), access.actor.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), body.settlement, access.scope.id, request.input.expectedVersion!]
  );
=======
  const access = requireAccess(request); const body = bodyRecord(request); const amount = integerField(body, 'amountMinor', 1);
=======
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const amount = integerField(body, 'amountMinor', 1);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const id = `withdrawal:${randomUUID()}`;
  const result = await database.query(
    `insert into finance.withdrawal(id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,
    requested_by,reason,evidence,created_at,updated_at,version) select $1,settlement.scope_id,settlement.id,$2,settlement.currency,$3,'submitted',
    $4,$5,$6::jsonb,clock_timestamp(),clock_timestamp(),0 from finance.settlement settlement where settlement.id=$7 and settlement.scope_id=$8
    and settlement.state='payable' and settlement.amount_minor-coalesce((select sum(withdrawal.amount_minor) from finance.withdrawal withdrawal
<<<<<<< HEAD
      where withdrawal.settlement_id=settlement.id and withdrawal.state not in('rejected','cancelled','failed')),0)>=$2 returning *`,
  [id, amount, textField(body, 'destinationRef', 500), access.actor.id, textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)), body.settlement, access.scope.id]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      where withdrawal.settlement_id=settlement.id and withdrawal.state not in('rejected','cancelled','failed')),0)>=$2
    and settlement.version=$9 returning *`,
    [id, amount, textField(body, 'destinationRef', 500), access.actor.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), body.settlement, access.scope.id, request.input.expectedVersion!]
  );
>>>>>>> 018b2a71 (chore(release): capture current production source)
  if (!result.rows[0]) throw new Error('FINANCE_WITHDRAWAL_EXCEEDS_PAYABLE');
  return rowResult(result, 201);
};

<<<<<<< HEAD
<<<<<<< HEAD
async function decide(request: OperationRequest, database: OperationDatabase, repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
  if (!decision) throw new Error('FINANCE_WITHDRAWAL_DECISION_INVALID');
  const result = await database.query(
    `update finance.withdrawal set state=$2,approved_by=case when $2='approved' then $3 else null end,
    evidence=evidence||$4::jsonb,updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$5 and state='submitted'
    and requested_by<>$3 and version=$6 returning *`,
    [request.input.path.withdrawalid!, decision, access.actor.id, JSON.stringify({ decisionReason: textField(body, 'reason', 1000), decisionEvidence: record(body.evidence) }), access.scope.id, request.input.expectedVersion!]
  );
  if (!result.rows[0]) throw new Error('FINANCE_WITHDRAWAL_CONFLICT_OR_SEPARATION');
  if (decision === 'approved') await repository(database).enqueue('settlement', access.scope.id, { withdrawal: request.input.path.withdrawalid! }, `job:withdrawal:${request.input.path.withdrawalid!}`);
  return rowResult(result, decision === 'approved' ? 202 : 200);
}

async function recover(request: OperationRequest, database: OperationDatabase, repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const id = request.input.path.withdrawalid!;
  const result = await database.query(
    `update finance.withdrawal set
    state=case when source_kind='referral' and state='uncertain' then 'processing' else 'approved' end,
    evidence=evidence||$3::jsonb,
    updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state in('uncertain','failed')
    and version=$4 returning *`,
    [id, access.scope.id, JSON.stringify({ recoveryReason: textField(body, 'reason', 1000), recoveryEvidence: record(body.evidence), recoveredBy: access.actor.id, trace: access.trace }), request.input.expectedVersion!]
  );
=======
async function decide(request: OperationRequest, database: OperationDatabase,
  repository: FinanceRepositoryFactory) {
  const access = requireAccess(request); const body = bodyRecord(request);
=======
async function decide(request: OperationRequest, database: OperationDatabase, repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
  if (!decision) throw new Error('FINANCE_WITHDRAWAL_DECISION_INVALID');
  const result = await database.query(
    `update finance.withdrawal set state=$2,approved_by=case when $2='approved' then $3 else null end,
    evidence=evidence||$4::jsonb,updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$5 and state='submitted'
    and requested_by<>$3 and version=$6 returning *`,
    [request.input.path.withdrawalid!, decision, access.actor.id, JSON.stringify({ decisionReason: textField(body, 'reason', 1000), decisionEvidence: record(body.evidence) }), access.scope.id, request.input.expectedVersion!]
  );
  if (!result.rows[0]) throw new Error('FINANCE_WITHDRAWAL_CONFLICT_OR_SEPARATION');
  if (decision === 'approved') await repository(database).enqueue('settlement', access.scope.id, { withdrawal: request.input.path.withdrawalid! }, `job:withdrawal:${request.input.path.withdrawalid!}`);
  return rowResult(result, decision === 'approved' ? 202 : 200);
}

<<<<<<< HEAD
async function recover(request: OperationRequest, database: OperationDatabase,
  repository: FinanceRepositoryFactory) {
  const access = requireAccess(request); const body = bodyRecord(request); const id = request.input.path.withdrawalid!;
  const result = await database.query(`update finance.withdrawal set state='approved',evidence=evidence||$3::jsonb,
    updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state in('uncertain','failed') returning *`,
  [id, access.scope.id, JSON.stringify({ recoveryReason: textField(body, 'reason', 1000), recoveryEvidence: record(body.evidence),
    recoveredBy: access.actor.id, trace: access.trace })]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
async function recover(request: OperationRequest, database: OperationDatabase, repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const id = request.input.path.withdrawalid!;
  const result = await database.query(
    `update finance.withdrawal set
    state=case when source_kind='referral' and state='uncertain' then 'processing' else 'approved' end,
    evidence=evidence||$3::jsonb,
    updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state in('uncertain','failed')
    and version=$4 returning *`,
    [id, access.scope.id, JSON.stringify({ recoveryReason: textField(body, 'reason', 1000), recoveryEvidence: record(body.evidence), recoveredBy: access.actor.id, trace: access.trace }), request.input.expectedVersion!]
  );
>>>>>>> 018b2a71 (chore(release): capture current production source)
  if (!result.rows[0]) throw new Error('FINANCE_WITHDRAWAL_NOT_RECOVERABLE');
  await repository(database).enqueue('settlement', access.scope.id, { withdrawal: id }, `job:withdrawal:${id}`, true);
  return rowResult(result, 202);
}

function record(value: unknown): Readonly<Record<string, unknown>> {
<<<<<<< HEAD
<<<<<<< HEAD
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
=======
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
>>>>>>> 018b2a71 (chore(release): capture current production source)
}
