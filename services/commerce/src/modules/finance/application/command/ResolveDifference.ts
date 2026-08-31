import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';

export function resolveDifferenceOperations(): OperationActions {
  return { 'finance.reconciliations.manage': resolveDifference };
}

const resolveDifference: NonNullable<OperationActions['finance.reconciliations.manage']> = async (request, database) => {
  const body = bodyRecord(request);
  const access = requireAccess(request);
  const action = textField(body, 'action', 32);
  const reconciliation = request.input.path.reconciliationid!;
  const reason = textField(body, 'reason', 1000);
  if (action === 'retry') {
    const result = await database.query(
      `update finance.reconciliation set state='matching',updated_at=clock_timestamp(),version=version+1
      where id=$1 and scope_id=$2 and state='difference' and not exists(select 1 from finance.reconciliationitem item
        where item.reconciliation_id=$1 and item.state in('resolutionpending','resolved')) returning *`,
      [reconciliation, access.scope.id]
    );
    if (result.rows[0])
      await database.query(
        `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'reconciliation','finance',$2,jsonb_build_object('reconciliation',$3),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())
      on conflict(id) do update set state='queued',attempts=0,available_at=clock_timestamp(),updated_at=clock_timestamp()`,
        [`job:reconciliation:${reconciliation}`, access.scope.id, reconciliation]
      );
    return rowResult(result);
  }
  if (action === 'resolve') {
    const itemVersion = integerField(body, 'itemVersion');
    const result = await database.query<Record<string, unknown>>(
      `update finance.reconciliationitem item set state='resolutionpending',resolution=$4::jsonb,
      resolved_by=$5,resolved_at=clock_timestamp(),version=item.version+1 from finance.reconciliation reconciliation
      where item.id=$1 and item.reconciliation_id=$2 and reconciliation.id=$2 and reconciliation.scope_id=$3 and item.state='difference'
      and item.version=$6 and item.reason_code is distinct from 'MANY_TO_ONE_UNSUPPORTED'
      returning item.*`,
      [textField(body, 'item'), reconciliation, access.scope.id, JSON.stringify({ reason, evidence: body.evidence ?? {} }), access.actor.id, itemVersion]
    );
    const item = result.rows[0];
    if (!item) throw new Error('RESOURCE_NOT_FOUND');
    const parent = await database.query<{ version: number; state: string }>(
      `update finance.reconciliation
      set updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state='difference'
      returning version,state`,
      [reconciliation, access.scope.id]
    );
    return itemResult(item, parent.rows[0]);
  }
  if (action === 'approveitem') {
    const itemVersion = integerField(body, 'itemVersion');
    const result = await database.query<Record<string, unknown>>(
      `update finance.reconciliationitem item set state='resolved',approved_by=$4,
      approved_at=clock_timestamp(),version=item.version+1 from finance.reconciliation reconciliation where item.id=$1
      and item.reconciliation_id=$2 and reconciliation.id=$2 and reconciliation.scope_id=$3 and item.state='resolutionpending'
      and item.version=$5 and item.resolved_by<>$4 returning item.*`,
      [textField(body, 'item'), reconciliation, access.scope.id, access.actor.id, itemVersion]
    );
    const item = result.rows[0];
    if (!item) throw new Error('RESOURCE_NOT_FOUND');
    const parent = await database.query<{ version: number; state: string }>(
      `update finance.reconciliation
      set state=case when not exists(select 1 from finance.reconciliationitem where reconciliation_id=$1
        and state in('difference','resolutionpending')) then 'resolved' else state end,
      updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state='difference'
      returning version,state`,
      [reconciliation, access.scope.id]
    );
    return itemResult(item, parent.rows[0]);
  }
  if (action !== 'approve') throw new Error('FINANCE_RECONCILIATION_ACTION_INVALID');
  const result = await database.query(
    `update finance.reconciliation reconciliation set state='approved',approved_by=$3,
    evidence=evidence||$4::jsonb,updated_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2
    and state='balanced' and created_by<>$3 and not exists(select 1 from finance.reconciliationitem item
      where item.reconciliation_id=reconciliation.id and (item.state<>'matched' or item.reason_code is not null
        or item.difference_minor<>0)) returning *`,
    [reconciliation, access.scope.id, access.actor.id, JSON.stringify({ decisionReason: reason, trace: access.trace, evidence: body.evidence ?? {} })]
  );
  if (result.rows[0])
    await database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'settlement','finance',$2,jsonb_build_object('reconciliation',$3),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())
    on conflict(id) do nothing`,
      [`job:settlement:${reconciliation}`, access.scope.id, reconciliation]
    );
  return rowResult(result);
};

function itemResult(item: Readonly<Record<string, unknown>>, parent: Readonly<{ version: number; state: string }> | undefined) {
  if (!parent) throw new Error('FINANCE_RECONCILIATION_STATE_CONFLICT');
  return { status: 200, body: { ...item, itemVersion: item.version, version: parent.version, reconciliationState: parent.state }, headers: { etag: `"${String(parent.version)}"` } } as const;
}
