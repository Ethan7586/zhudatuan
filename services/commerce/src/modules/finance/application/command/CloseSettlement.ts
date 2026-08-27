import { randomUUID } from 'node:crypto';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { FinancePort } from '../../FinancePort';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import type { FinanceRepositoryFactory } from '../port/FinanceRepository';
<<<<<<< HEAD
import { captureSettlementSnapshot, safeSettlementMinor, settlementRule, verifySettlementSnapshot, type SettlementSnapshotState } from './SettlementSnapshot';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

const policy = new SettlementPolicy();
const finance = new FinancePort();

export function closeSettlementOperations(repository: FinanceRepositoryFactory): OperationActions {
  return {
    'finance.settlements.decide': (request, database) => decide(request, database, repository),
    'finance.settlements.adjust': (request, database) => adjust(request, database, repository),
  };
}

async function decide(request: OperationRequest, database: OperationDatabase, repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const approved = body.decision === 'approved';
  if (!approved && body.decision !== 'rejected') throw new Error('FINANCE_SETTLEMENT_DECISION_INVALID');
<<<<<<< HEAD
  const result = await database.query<DecisionRow>(
    `select id,requested_by,amount_minor::text amount_minor from finance.settlement
    where id=$1 and scope_id=$2 and state='draft' and requested_by<>$3 and version=$4 for update`,
    [request.input.path.settlementid!, access.scope.id, access.actor.id, request.input.expectedVersion!]
  );
  const selected = result.rows[0];
  if (!selected) throw new Error('FINANCE_SETTLEMENT_CONFLICT_OR_SEPARATION');
  policy.assertDecision(selected.requested_by, access.actor.id, safeSettlementMinor(selected.amount_minor));
  const authoritative = approved ? await verifySettlementSnapshot(database, selected.id, access.scope.id) : null;
  if (authoritative) await postSettlement(database, authoritative);
  const updated = await database.query(
    `update finance.settlement set state=$2,approved_by=case when $2='payable' then $3 else null end,
    approved_at=case when $2='payable' then clock_timestamp() else null end,evidence=evidence||$4::jsonb,version=version+1
    where id=$1 returning *`,
    [selected.id, approved ? 'payable' : 'cancelled', access.actor.id, JSON.stringify({ reason: textField(body, 'reason', 1000), evidence: object(body.evidence) })]
  );
  if (authoritative) {
    await database.query('select finance.mark_platform_settlement_split_paid($1)', [selected.id]);
    await repository(database).event('finance.settlement.approved', 'settlement', selected.id, authoritative.header.scope, {
      settlement: selected.id,
      partner: authoritative.header.partner,
      amountMinor: authoritative.header.netMinor,
      grossMinor: authoritative.header.grossMinor,
      feeMinor: authoritative.header.feeMinor,
      currency: authoritative.header.currency,
      snapshotHash: authoritative.snapshot.snapshotHash,
      snapshotVersion: authoritative.snapshot.version,
    });
  }
  return rowResult(updated);
=======
  const settlement = await database.query<Settlement>(`select id,scope_id,partner_id,amount_minor::float8 amount_minor,
    gross_minor::float8 gross_minor,fee_minor::float8 fee_minor,currency,requested_by from finance.settlement
    where id=$1 and scope_id=$2 and state='draft' and requested_by<>$3 for update`,
  [request.input.path.settlementid!, access.scope.id, access.actor.id]);
  const selected = settlement.rows[0];
  if (!selected) throw new Error('FINANCE_SETTLEMENT_CONFLICT_OR_SEPARATION');
  policy.assertDecision(selected.requested_by, access.actor.id, selected.amount_minor);
  if (approved) await postSettlement(database, selected);
  const result = await database.query(`update finance.settlement set state=$2,approved_by=case when $2='payable' then $3 else null end,
    approved_at=case when $2='payable' then clock_timestamp() else null end,evidence=evidence||$4::jsonb,version=version+1 where id=$1 returning *`,
  [selected.id, approved ? 'payable' : 'cancelled', access.actor.id,
    JSON.stringify({ reason: textField(body, 'reason', 1000), evidence: record(body.evidence) })]);
  if (approved) {
    await database.query(`update finance.split set state='paid' where settlement_id=$1 and beneficiary_type='platform' and state='frozen'`, [selected.id]);
    await repository(database).event('finance.settlement.approved', 'settlement', selected.id, selected.scope_id, { settlement: selected.id,
      partner: selected.partner_id,amountMinor: selected.amount_minor,grossMinor: selected.gross_minor,feeMinor: selected.fee_minor,
      currency: selected.currency });
  }
  return rowResult(result);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

async function adjust(request: OperationRequest, database: OperationDatabase, repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const action = textField(body, 'action', 16);
  if (action === 'request') {
    const direction = body.direction === 'increase' ? 'increase' : body.direction === 'decrease' ? 'decrease' : null;
    if (!direction) throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_DIRECTION_INVALID');
    const amount = integerField(body, 'amountMinor', 1);
    const tax = body.taxMinor === undefined ? 0 : integerField(body, 'taxMinor');
<<<<<<< HEAD
    const source = await database.query<RequestRow>(
      `select line.id,settlement.gross_minor::text gross_minor from finance.settlement settlement
      join finance.settlementline line on line.settlement_id=settlement.id
      where settlement.id=$1 and settlement.scope_id=$2 and settlement.state='draft' and line.id=$3 and line.adjustment_of is null
      and settlement.version=$4 and not exists(select 1 from finance.settlementadjustment adjustment
        where adjustment.settlement_line_id=line.id and adjustment.state='pending') for update of settlement,line`,
      [request.input.path.settlementid!, access.scope.id, textField(body, 'line'), request.input.expectedVersion!]
    );
    const line = source.rows[0];
    if (!line) throw new Error('FINANCE_SETTLEMENT_LINE_NOT_ADJUSTABLE');
    const rule = await settlementRule(database, access.scope.id);
    policy.split(safeSettlementMinor(line.gross_minor) + (direction === 'increase' ? amount : -amount), rule.rule);
    const id = `settlementadjustment:${randomUUID()}`;
    const inserted = await database.query(
      `insert into finance.settlementadjustment(id,settlement_id,settlement_line_id,scope_id,direction,
      amount_minor,tax_minor,state,requested_by,reason,evidence,created_at,version)
      values($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10::jsonb,clock_timestamp(),0) returning *`,
      [id, request.input.path.settlementid!, line.id, access.scope.id, direction, amount, tax, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(object(body.evidence))]
    );
    return rowResult(inserted, 201);
  }
  if (action !== 'approve' && action !== 'reject') throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_ACTION_INVALID');
  return decideAdjustment(
    database,
    request.input.path.settlementid!,
    textField(body, 'adjustment'),
    action,
    access.actor.id,
    textField(body, 'reason', 1000),
    object(body.evidence),
    access.scope.id,
    request.input.expectedVersion!,
    repository
  );
}

async function decideAdjustment(
  database: OperationDatabase,
  settlement: string,
  adjustment: string,
  action: 'approve' | 'reject',
  actor: string,
  reason: string,
  evidence: Readonly<Record<string, unknown>>,
  scope: string,
  expectedVersion: number,
  repository: FinanceRepositoryFactory
) {
  const result = await database.query<AdjustmentRow>(
    `select adjustment.id,adjustment.direction,adjustment.amount_minor::text amount_minor,
    settlement.gross_minor::text gross_minor
    from finance.settlementadjustment adjustment join finance.settlement settlement on settlement.id=adjustment.settlement_id
    join finance.settlementline line on line.id=adjustment.settlement_line_id
    where adjustment.id=$1 and adjustment.settlement_id=$2 and adjustment.scope_id=$3 and adjustment.state='pending'
      and adjustment.requested_by<>$4 and settlement.state='draft' and settlement.version=$5 for update of adjustment,settlement,line`,
    [adjustment, settlement, scope, actor, expectedVersion]
  );
  const selected = result.rows[0];
  if (!selected) throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_CONFLICT_OR_SEPARATION');
  const updated = await database.query(
    `update finance.settlementadjustment set state=$2,approved_by=$3,decided_at=clock_timestamp(),
    reason=$4,evidence=evidence||$5::jsonb,version=version+1 where id=$1 returning *`,
    [adjustment, action === 'approve' ? 'approved' : 'rejected', actor, reason, JSON.stringify({ decisionEvidence: evidence })]
  );
  if (action === 'reject') return rowResult(updated);
  const amount = safeSettlementMinor(selected.amount_minor);
  const priorGross = safeSettlementMinor(selected.gross_minor);
  const gross = priorGross + (selected.direction === 'increase' ? amount : -amount);
  const rule = await settlementRule(database, scope);
  const split = policy.split(gross, rule.rule);
  const changed = await database.query<{ version: number }>(
    `update finance.settlement set gross_minor=$2,fee_minor=$3,amount_minor=$4,invoice_basis=$5,version=version+1,
    evidence=evidence||jsonb_build_object('lastAdjustment',$6::text) where id=$1 and state='draft' and version=$7
    returning version::float8 version`,
    [settlement, gross, split.feeMinor, split.netMinor, split.invoiceBasis, adjustment, expectedVersion]
  );
  if (!changed.rows[0]) throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_CONFLICT_OR_SEPARATION');
  await database.query('select finance.apply_settlement_adjustment_facts($1)', [adjustment]);
  const authoritative = await captureSettlementSnapshot(database, settlement, scope);
  if (authoritative.snapshot.version !== changed.rows[0].version) throw new Error('FINANCE_SETTLEMENT_SNAPSHOT_STALE');
  await repository(database).event('finance.settlement.adjusted', 'settlement', settlement, scope, {
    settlement,
    adjustment,
    direction: selected.direction,
    amountMinor: amount,
    grossMinor: authoritative.header.grossMinor,
    netMinor: authoritative.header.netMinor,
    feeMinor: authoritative.header.feeMinor,
    snapshotHash: authoritative.snapshot.snapshotHash,
    snapshotVersion: authoritative.snapshot.version,
  });
  return rowResult(updated);
}

async function postSettlement(database: OperationDatabase, state: SettlementSnapshotState): Promise<void> {
  const value = state.header;
  await finance.post(database, {
    scope: value.scope,
    referenceType: 'finance.settlement.approved',
    referenceId: `${value.id}:partner`,
    currency: value.currency,
    description: 'Settlement liability accrual',
    debit: { code: 'settlement.cost', kind: 'expense' },
    credit: { code: `settlement.payable.${value.partner}`, kind: 'liability' },
    amountMinor: value.netMinor,
    occurredAt: value.recognitionAt,
  });
  if (value.feeMinor > 0)
    await finance.post(database, {
      scope: value.scope,
      referenceType: 'finance.settlement.approved',
      referenceId: `${value.id}:platform`,
      currency: value.currency,
      description: 'Settlement platform fee',
      debit: { code: 'settlement.cost', kind: 'expense' },
      credit: { code: 'platform.fee', kind: 'income' },
      amountMinor: value.feeMinor,
      occurredAt: value.recognitionAt,
    });
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}
type DecisionRow = { id: string; requested_by: string; amount_minor: string };
type RequestRow = { id: string; gross_minor: string };
type AdjustmentRow = {
  id: string;
  direction: 'increase' | 'decrease';
  amount_minor: string;
  gross_minor: string;
};
=======
    const source = await database.query<{ id: string; gross_minor: number; rule: unknown }>(`select line.id,
      settlement.gross_minor::float8 gross_minor,policy.rule from finance.settlement settlement
      join finance.settlementline line on line.settlement_id=settlement.id
      left join finance.policy policy on policy.scope_id=settlement.scope_id and policy.kind='settlement' and policy.state='active'
      where settlement.id=$1 and settlement.scope_id=$2 and settlement.state='draft' and line.id=$3 and line.adjustment_of is null
      and not exists(select 1 from finance.settlementadjustment adjustment where adjustment.settlement_line_id=line.id and adjustment.state='pending')
      for update of settlement,line`, [request.input.path.settlementid!, access.scope.id, textField(body, 'line')]);
    const line = source.rows[0];
    if (!line) throw new Error('FINANCE_SETTLEMENT_LINE_NOT_ADJUSTABLE');
    policy.split(line.gross_minor+(direction === 'increase' ? amount : -amount), line.rule);
    const id = `settlementadjustment:${randomUUID()}`;
    const result = await database.query(`insert into finance.settlementadjustment(id,settlement_id,settlement_line_id,scope_id,direction,
      amount_minor,tax_minor,state,requested_by,reason,evidence,created_at,version)
      values($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10::jsonb,clock_timestamp(),0) returning *`,
    [id, request.input.path.settlementid!, line.id, access.scope.id, direction, amount, tax, access.actor.id,
      textField(body, 'reason', 1000), JSON.stringify(record(body.evidence))]);
    return rowResult(result, 201);
  }
  if (action !== 'approve' && action !== 'reject') throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_ACTION_INVALID');
  return decideAdjustment(database, request.input.path.settlementid!, textField(body, 'adjustment'), action, access.actor.id,
    textField(body, 'reason', 1000), record(body.evidence), access.scope.id, repository);
}

async function decideAdjustment(database: OperationDatabase, settlement: string, adjustment: string, action: 'approve' | 'reject', actor: string,
  reason: string, evidence: Readonly<Record<string, unknown>>, scope: string, repository: FinanceRepositoryFactory) {
  const source = await database.query<Adjustment>(`select adjustment.*,settlement.partner_id,settlement.gross_minor::float8 gross_minor,
    settlement.amount_minor::float8 net_minor,settlement.invoice_basis,line.reconciliation_item_id,policy.rule
    from finance.settlementadjustment adjustment join finance.settlement settlement on settlement.id=adjustment.settlement_id
    join finance.settlementline line on line.id=adjustment.settlement_line_id
    left join finance.policy policy on policy.scope_id=settlement.scope_id and policy.kind='settlement' and policy.state='active'
    where adjustment.id=$1 and adjustment.settlement_id=$2 and adjustment.scope_id=$3 and adjustment.state='pending'
      and adjustment.requested_by<>$4 and settlement.state='draft' for update of adjustment,settlement,line`,
  [adjustment, settlement, scope, actor]);
  const selected = source.rows[0];
  if (!selected) throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_CONFLICT_OR_SEPARATION');
  const result = await database.query(`update finance.settlementadjustment set state=$2,approved_by=$3,decided_at=clock_timestamp(),
    reason=$4,evidence=evidence||$5::jsonb,version=version+1 where id=$1 returning *`,
  [adjustment, action === 'approve' ? 'approved' : 'rejected', actor, reason, JSON.stringify({ decisionEvidence: evidence })]);
  if (action === 'reject') return rowResult(result);
  const gross = selected.gross_minor+(selected.direction === 'increase' ? selected.amount_minor : -selected.amount_minor);
  const split = policy.split(gross, selected.rule);
  const invoice = selected.invoice_basis === 'gross' ? selected.amount_minor : Math.abs(split.netMinor-selected.net_minor);
  await database.query(`insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
    amount_minor,invoice_minor,tax_minor,direction,state,adjustment_of,created_at) values($1,$2,$3,$4,'adjustment',$5,$6,$7,$8,$9,
    'frozen',$10,clock_timestamp())`, [`settlementline:${adjustment}`, settlement, selected.reconciliation_item_id, scope, adjustment,
    selected.amount_minor, invoice, selected.tax_minor, selected.direction, selected.settlement_line_id]);
  await database.query(`update finance.settlement set gross_minor=$2,fee_minor=$3,amount_minor=$4,version=version+1,
    evidence=evidence||jsonb_build_object('lastAdjustment',$5) where id=$1`, [settlement, gross, split.feeMinor, split.netMinor, adjustment]);
  await database.query(`update finance.split set amount_minor=$2,basis_points=$3 where settlement_id=$1 and beneficiary_type='partner'`,
  [settlement, split.netMinor, 10_000-split.basisPoints]);
  await database.query(`insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
    values($1,$2,$3,'platform','platform',$4,$5,'frozen',clock_timestamp()) on conflict(settlement_id,beneficiary_type,beneficiary_id)
    do update set amount_minor=excluded.amount_minor,basis_points=excluded.basis_points where finance.split.state='frozen'`,
  [`split:${settlement}:platform`, settlement, scope, split.feeMinor, split.basisPoints]);
  await repository(database).event('finance.settlement.adjusted', 'settlement', settlement, scope, { settlement, adjustment, direction: selected.direction,
    amountMinor: selected.amount_minor,grossMinor: gross,netMinor: split.netMinor,feeMinor: split.feeMinor });
  return rowResult(result);
}

async function postSettlement(database: OperationDatabase, selected: Settlement): Promise<void> {
  await finance.post(database, { scope: selected.scope_id,referenceType: 'finance.settlement.approved',referenceId: `${selected.id}:partner`,
    currency: selected.currency,description: 'Settlement liability accrual',debit: { code: 'settlement.cost', kind: 'expense' },
    credit: { code: `settlement.payable.${selected.partner_id}`, kind: 'liability' },amountMinor: selected.amount_minor });
  if (selected.fee_minor > 0) await finance.post(database, { scope: selected.scope_id,referenceType: 'finance.settlement.approved',
    referenceId: `${selected.id}:platform`,currency: selected.currency,description: 'Settlement platform fee',
    debit: { code: 'settlement.cost', kind: 'expense' },credit: { code: 'platform.fee', kind: 'income' },amountMinor: selected.fee_minor });
}

interface Settlement { readonly id: string; readonly scope_id: string; readonly partner_id: string; readonly amount_minor: number;
  readonly gross_minor: number; readonly fee_minor: number; readonly currency: string; readonly requested_by: string }
interface Adjustment { readonly id: string; readonly settlement_line_id: string; readonly direction: 'increase' | 'decrease';
  readonly amount_minor: number; readonly tax_minor: number; readonly requested_by: string; readonly partner_id: string;
  readonly gross_minor: number; readonly net_minor: number; readonly invoice_basis: 'gross' | 'net'; readonly reconciliation_item_id: string;
  readonly rule: unknown }
function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
