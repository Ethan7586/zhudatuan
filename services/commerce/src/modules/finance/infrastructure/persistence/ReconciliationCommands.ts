import type { FinanceAction, FinanceEntries } from './FinanceOperation';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { rowResult } from '../../../../adapter/database/DatabaseResult';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

export function reconciliationCommands(): FinanceEntries<'reconciliationsManage'> {
  return { reconciliationsManage: resolveDifference };
}

const resolveDifference: FinanceAction = async (request, database) => {
  const body = bodyRecord(request.input);
  const access = requireAccess(request);
  const action = textField(body, 'action', 32);
  const reconciliation = request.input.path.reconciliationid!;
  const reason = textField(body, 'reason', 1000);
  if (action === 'retry') {
    const result = await database.query(
      `update finance.reconciliation set state='matching',updated_at=clock_timestamp(),version=version+1
      where id=$1 and scope_id=$2 and state in('difference','resolved') returning *`,
      [reconciliation, access.scope.id]
    );
    if (result.rows[0]) await new PgRuntimeWriter(database).reschedule({ id: `job:reconciliation:${reconciliation}`, kind: 'reconciliation', owner: 'finance', scope: access.scope.id, payload: { reconciliation }, priority: 20 });
    return rowResult(result);
  }
  if (action === 'resolve') {
    const result = await database.query(
      `update finance.reconciliationitem item set state='resolutionpending',resolution=$4::jsonb,
      resolved_by=$5,resolved_at=clock_timestamp(),version=version+1 from finance.reconciliation reconciliation
      where item.id=$1 and item.reconciliation_id=$2 and reconciliation.id=$2 and reconciliation.scope_id=$3 and item.state='difference'
      returning item.*`,
      [textField(body, 'item'), reconciliation, access.scope.id, JSON.stringify({ reason, evidence: body.evidence ?? {} }), access.actor.id]
    );
    return rowResult(result);
  }
  if (action === 'approveitem') {
    const result = await database.query(
      `update finance.reconciliationitem item set state='resolved',approved_by=$4,
      approved_at=clock_timestamp(),version=version+1 from finance.reconciliation reconciliation where item.id=$1
      and item.reconciliation_id=$2 and reconciliation.id=$2 and reconciliation.scope_id=$3 and item.state='resolutionpending'
      and item.resolved_by<>$4 returning item.*`,
      [textField(body, 'item'), reconciliation, access.scope.id, access.actor.id]
    );
    await database.query(
      `update finance.reconciliation set state='resolved',updated_at=clock_timestamp(),version=version+1 where id=$1
      and state='difference' and not exists(select 1 from finance.reconciliationitem where reconciliation_id=$1
        and state in('difference','resolutionpending'))`,
      [reconciliation]
    );
    return rowResult(result);
  }
  if (action !== 'approve') throw new Error('FINANCE_RECONCILIATION_ACTION_INVALID');
  const result = await database.query(
    `update finance.reconciliation reconciliation set state='approved',approved_by=$3,
    evidence=evidence||$4::jsonb,updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2
    and state in('balanced','resolved') and created_by<>$3 and not exists(select 1 from finance.reconciliationitem item
      where item.reconciliation_id=reconciliation.id and item.state not in('matched','resolved')) returning *`,
    [reconciliation, access.scope.id, access.actor.id, JSON.stringify({ decisionReason: reason, trace: access.trace, evidence: body.evidence ?? {} })]
  );
  if (result.rows[0]) await new PgRuntimeWriter(database).schedule({ id: `job:settlement:${reconciliation}`, kind: 'settlement', owner: 'finance', scope: access.scope.id, payload: { reconciliation }, priority: 20 });
  return rowResult(result);
};
