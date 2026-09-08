import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { rowResult } from '../../../../platform/database/DatabaseResult';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import type { OperationRequest } from '../../../../pipeline/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../pipeline/Validation';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import { financeEvidence } from './FinanceEvidence';
import type { FinanceEntries } from './FinanceOperation';
import type { FinanceWorkflowFactory } from './PgFinanceWorkflow';

const policy = new SettlementPolicy();

export function settlementAdjustmentActions(workflow: FinanceWorkflowFactory): FinanceEntries<'settlementsAdjust'> {
  return { settlementsAdjust: (request, database) => adjust(request, database, workflow) };
}

async function adjust(request: OperationRequest, database: SqlExecutor, workflow: FinanceWorkflowFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const action = textField(body, 'action', 16);
  if (action === 'request') {
    const direction = body.direction === 'increase' ? 'increase' : body.direction === 'decrease' ? 'decrease' : null;
    if (!direction) throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_DIRECTION_INVALID');
    const amount = integerField(body, 'amountMinor', 1);
    const tax = body.taxMinor === undefined ? 0 : integerField(body, 'taxMinor');
    const source = await database.query<{ id: string; gross_minor: number; rule: unknown }>(
      `select line.id,settlement.gross_minor::float8 gross_minor,policy.rule from finance.settlement settlement
      join finance.settlementline line on line.settlement_id=settlement.id
      left join finance.policy policy on policy.scope_id=settlement.scope_id and policy.kind='settlement' and policy.state='active'
      where settlement.id=$1 and settlement.scope_id=$2 and settlement.state='draft' and line.id=$3 and line.adjustment_of is null
      and not exists(select 1 from finance.settlementadjustment adjustment where adjustment.settlement_line_id=line.id and adjustment.state='pending')
      for update of settlement,line`,
      [request.input.path.settlementid!, access.scope.id, textField(body, 'line')]
    );
    const line = source.rows[0];
    if (!line) throw new Error('FINANCE_SETTLEMENT_LINE_NOT_ADJUSTABLE');
    policy.split(line.gross_minor + (direction === 'increase' ? amount : -amount), line.rule);
    const id = `settlementadjustment:${randomUUID()}`;
    const result = await database.query(
      `insert into finance.settlementadjustment(id,settlement_id,settlement_line_id,scope_id,direction,
      amount_minor,tax_minor,state,requested_by,reason,evidence,created_at,version)
      values($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10::jsonb,clock_timestamp(),0) returning *`,
      [id, request.input.path.settlementid!, line.id, access.scope.id, direction, amount, tax, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(financeEvidence(body.evidence))]
    );
    return rowResult(result, 201);
  }
  if (action !== 'approve' && action !== 'reject') throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_ACTION_INVALID');
  return decideAdjustment(database, request.input.path.settlementid!, textField(body, 'adjustment'), action, access.actor.id, textField(body, 'reason', 1000), financeEvidence(body.evidence), access.scope.id, workflow);
}

async function decideAdjustment(
  database: SqlExecutor,
  settlement: string,
  adjustment: string,
  action: 'approve' | 'reject',
  actor: string,
  reason: string,
  evidence: Readonly<Record<string, unknown>>,
  scope: string,
  workflow: FinanceWorkflowFactory
) {
  const source = await database.query<Adjustment>(
    `select adjustment.id,adjustment.settlement_id,adjustment.settlement_line_id,
    adjustment.scope_id,adjustment.direction,adjustment.amount_minor::float8 amount_minor,adjustment.tax_minor::float8 tax_minor,
    adjustment.state,adjustment.requested_by,adjustment.approved_by,adjustment.reason,adjustment.evidence,adjustment.created_at,
    adjustment.decided_at,adjustment.version,settlement.partner_id,settlement.gross_minor::float8 gross_minor,
    settlement.amount_minor::float8 net_minor,settlement.invoice_basis,line.reconciliation_item_id,policy.rule
    from finance.settlementadjustment adjustment join finance.settlement settlement on settlement.id=adjustment.settlement_id
    join finance.settlementline line on line.id=adjustment.settlement_line_id
    left join finance.policy policy on policy.scope_id=settlement.scope_id and policy.kind='settlement' and policy.state='active'
    where adjustment.id=$1 and adjustment.settlement_id=$2 and adjustment.scope_id=$3 and adjustment.state='pending'
      and adjustment.requested_by<>$4 and settlement.state='draft' for update of adjustment,settlement,line`,
    [adjustment, settlement, scope, actor]
  );
  const selected = source.rows[0];
  if (!selected) throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_CONFLICT_OR_SEPARATION');
  const result = await database.query(
    `update finance.settlementadjustment set state=$2,approved_by=$3,decided_at=clock_timestamp(),
    reason=$4,evidence=evidence||$5::jsonb,version=version+1 where id=$1 returning *`,
    [adjustment, action === 'approve' ? 'approved' : 'rejected', actor, reason, JSON.stringify({ decisionEvidence: evidence })]
  );
  if (action === 'reject') return rowResult(result);
  const gross = selected.gross_minor + (selected.direction === 'increase' ? selected.amount_minor : -selected.amount_minor);
  const split = policy.split(gross, selected.rule);
  const invoice = selected.invoice_basis === 'gross' ? selected.amount_minor : Math.abs(split.netMinor - selected.net_minor);
  await database.query(
    `insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
    amount_minor,invoice_minor,tax_minor,direction,state,adjustment_of,created_at) values($1,$2,$3,$4,'adjustment',$5,$6,$7,$8,$9,
    'frozen',$10,clock_timestamp())`,
    [`settlementline:${adjustment}`, settlement, selected.reconciliation_item_id, scope, adjustment, selected.amount_minor, invoice, selected.tax_minor, selected.direction, selected.settlement_line_id]
  );
  await database.query(`update finance.settlement set gross_minor=$2,fee_minor=$3,amount_minor=$4,version=version+1,evidence=evidence||jsonb_build_object('lastAdjustment',$5) where id=$1`, [
    settlement,
    gross,
    split.feeMinor,
    split.netMinor,
    adjustment,
  ]);
  await database.query(`update finance.split set amount_minor=$2,basis_points=$3 where settlement_id=$1 and beneficiary_type='partner'`, [settlement, split.netMinor, 10_000 - split.basisPoints]);
  await database.query(
    `insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
    values($1,$2,$3,'platform','platform',$4,$5,'frozen',clock_timestamp()) on conflict(settlement_id,beneficiary_type,beneficiary_id)
    do update set amount_minor=excluded.amount_minor,basis_points=excluded.basis_points where finance.split.state='frozen'`,
    [`split:${settlement}:platform`, settlement, scope, split.feeMinor, split.basisPoints]
  );
  await workflow(database).event('finance.settlement.adjusted', 'settlement', settlement, scope, {
    settlement,
    adjustment,
    direction: selected.direction,
    amountMinor: selected.amount_minor,
    grossMinor: gross,
    netMinor: split.netMinor,
    feeMinor: split.feeMinor,
  });
  return rowResult(result);
}

interface Adjustment {
  readonly id: string;
  readonly settlement_line_id: string;
  readonly direction: 'increase' | 'decrease';
  readonly amount_minor: number;
  readonly tax_minor: number;
  readonly requested_by: string;
  readonly partner_id: string;
  readonly gross_minor: number;
  readonly net_minor: number;
  readonly invoice_basis: 'gross' | 'net';
  readonly reconciliation_item_id: string;
  readonly rule: unknown;
}
