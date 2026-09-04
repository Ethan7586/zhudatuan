import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
export type SettlementRuleSnapshot = { readonly id: string; readonly version: number; readonly hash: string; readonly rule: unknown };
// prettier-ignore
export type SettlementSnapshotState = { readonly header:SettlementHeader;readonly snapshot:SettlementSnapshot };
export async function captureSettlementSnapshot(database: OperationDatabase, settlement: string, scope: string): Promise<SettlementSnapshotState> {
  const state = await derive(database, settlement, scope);
  await append(database, state);
  return state;
}
export async function verifySettlementSnapshot(database: OperationDatabase, settlement: string, scope: string): Promise<SettlementSnapshotState> {
  const state = await derive(database, settlement, scope);
  const snapshots = object(state.evidence.authoritativeSnapshots);
  let frozen = snapshots[String(state.snapshot.version)];
  if (frozen === undefined) {
    if (state.snapshot.version !== 0) throw new Error('FINANCE_SETTLEMENT_SNAPSHOT_MISSING');
    assertInitial(state);
    await append(database, state);
    frozen = state.snapshot;
  }
  const active = object(state.evidence.activeSnapshot);
  if (canonical(frozen) !== canonical(state.snapshot) || active.version !== state.snapshot.version || active.hash !== state.snapshot.snapshotHash) {
    throw new Error('FINANCE_SETTLEMENT_SNAPSHOT_STALE');
  }
  return state;
}
export async function settlementRule(database: OperationDatabase, scope: string): Promise<SettlementRuleSnapshot> {
  const result = await database.query<RuleRow>(
    `select id,version::float8 version,rule,encode(public.digest(id||':'||version||':'||rule::text,'sha256'),'hex') hash
    from finance.policy where scope_id=$1 and kind='settlement' and state='active' for share`,
    [scope]
  );
  const row = result.rows[0];
  if (row) return { id: row.id, version: version(row.version), hash: row.hash, rule: row.rule };
  const rule = Object.freeze({ basisPoints: 0, invoiceBasis: 'gross' });
  return Object.freeze({ id: 'finance.policy.default.settlement', version: 1, rule, hash: digest(`finance.policy.default.settlement:1:${JSON.stringify(rule)}`) });
}
export function safeSettlementMinor(value: unknown, allowZero = false): number {
  if ((typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') || !/^-?\d+$/.test(String(value))) {
    throw new Error('FINANCE_SETTLEMENT_AMOUNT_UNSAFE');
  }
  const integer = BigInt(value);
  if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER) || (allowZero ? integer < 0n : integer <= 0n)) {
    throw new Error('FINANCE_SETTLEMENT_AMOUNT_UNSAFE');
  }
  return Number(integer);
}
async function append(database: OperationDatabase, state: InternalState): Promise<void> {
  const result = await database.query(
    `update finance.settlement set evidence=jsonb_set(jsonb_set(evidence,'{authoritativeSnapshots}',
      coalesce(evidence->'authoritativeSnapshots','{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),true),
      '{activeSnapshot}',$4::jsonb,true) where id=$1 and state='draft' and version=$2
      and not (coalesce(evidence->'authoritativeSnapshots','{}'::jsonb) ? $2::text) returning id`,
    [state.header.id, state.snapshot.version, JSON.stringify(state.snapshot), JSON.stringify({ version: state.snapshot.version, hash: state.snapshot.snapshotHash })]
  );
  if (!result.rows[0]) throw new Error('FINANCE_SETTLEMENT_SNAPSHOT_IMMUTABLE');
  state.evidence.authoritativeSnapshots = { ...object(state.evidence.authoritativeSnapshots), [String(state.snapshot.version)]: state.snapshot };
  state.evidence.activeSnapshot = { version: state.snapshot.version, hash: state.snapshot.snapshotHash };
}
async function derive(database: OperationDatabase, settlement: string, scope: string): Promise<InternalState> {
  const result = await database.query<HeaderRow>(
    `select settlement.id,settlement.scope_id,settlement.partner_id,settlement.reconciliation_id,settlement.currency,
      settlement.gross_minor::text gross_minor,settlement.fee_minor::text fee_minor,settlement.amount_minor::text net_minor,
      settlement.invoice_basis,settlement.version::float8 version,settlement.evidence,reconciliation.statement_hash,
      statement.period_end::text statement_period_end,statement.timezone statement_timezone,
      (((statement.period_end+1)::timestamp at time zone statement.timezone)-interval '1 microsecond')::text recognition_at
      from finance.settlement settlement
      join finance.reconciliation reconciliation on reconciliation.id=settlement.reconciliation_id
      join channel.statement statement on statement.id=reconciliation.statement_ref
        and statement.scope_id=reconciliation.scope_id and statement.provider=reconciliation.provider
        and statement.partner_id=reconciliation.partner_id and statement.sha256=reconciliation.statement_hash
      where settlement.id=$1 and settlement.scope_id=$2 and settlement.state='draft'
      for update of settlement,reconciliation,statement`,
    [settlement, scope]
  );
  const row = result.rows[0];
  if (!row) throw new Error('FINANCE_SETTLEMENT_SNAPSHOT_STALE');
  const header: SettlementHeader = {
    id: row.id,
    scope: row.scope_id,
    partner: row.partner_id,
    reconciliation: row.reconciliation_id,
    currency: row.currency,
    grossMinor: safeSettlementMinor(row.gross_minor),
    feeMinor: safeSettlementMinor(row.fee_minor, true),
    netMinor: safeSettlementMinor(row.net_minor),
    invoiceBasis: row.invoice_basis,
    version: version(row.version),
    statementHash: row.statement_hash,
    recognitionAt: row.recognition_at,
    statementTimezone: row.statement_timezone,
    statementPeriodEnd: row.statement_period_end,
    sourceGrossMinor: 0,
  };
  const rule = await settlementRule(database, scope);
  const items = await database.query<ItemRow>(
    `select id,kind,internal_type,internal_id,internal_minor::text internal_minor,state,reason_code,evidence
    from finance.reconciliationitem where reconciliation_id=$1 order by id for update`,
    [header.reconciliation]
  );
  const lines = await database.query<LineRow>(
    `select id,reconciliation_item_id,source_type,source_id,amount_minor::text amount_minor,invoice_minor::text invoice_minor,
    tax_minor::text tax_minor,direction,state,adjustment_of from finance.settlementline where settlement_id=$1 order by id for update`,
    [header.id]
  );
  const splits = await database.query<SplitRow>(
    `select id,beneficiary_type,beneficiary_id,amount_minor::text amount_minor,basis_points::float8 basis_points,state
    from finance.split where settlement_id=$1 order by id for update`,
    [header.id]
  );
  const adjustments = await database.query<AdjustmentRow>(
    `select id,settlement_line_id,direction,amount_minor::text amount_minor,tax_minor::text tax_minor,state,
    requested_by,approved_by,version::float8 version from finance.settlementadjustment where settlement_id=$1 order by id for update`,
    [header.id]
  );
  const categorized = items.rows.map((item) => ({ item, reference: object(item.evidence).journalReferenceType, eligible: object(item.evidence).settlementEligible }));
  const payable = categorized.filter(({ item, reference, eligible }) => item.state === 'matched' && item.reason_code === null && ['payment.succeeded', 'payment.refunded'].includes(String(reference)) && eligible === true);
  const excludedLate = categorized.filter(({ item, reference, eligible }) => item.state === 'matched' && item.reason_code === null && ['payment.late.detected', 'payment.late.refunded'].includes(String(reference)) && eligible !== true);
  if (payable.length === 0 || payable.length + excludedLate.length !== items.rows.length) throw new Error('FINANCE_SETTLEMENT_SOURCE_STALE');
  header.sourceGrossMinor = safeSettlementMinor(String(payable.reduce((sum, entry) => sum + (entry.item.kind === 'refund' ? -safeSettlementMinor(entry.item.internal_minor) : safeSettlementMinor(entry.item.internal_minor)), 0)));
  if (adjustments.rows.some((item) => item.state === 'pending')) throw new Error('FINANCE_SETTLEMENT_ADJUSTMENT_PENDING');
  const evidence = { ...object(row.evidence) };
  const recognition = object(evidence.recognition);
  const itemHash = digest(payable.map(({ item }) => sourceItem(item)).join(','));
  const excludedLateHash = digest(excludedLate.map(({ item }) => sourceItem(item)).join(','));
  const basis = object(evidence.payableBasis);
  const lateBasis = object(evidence.excludedLateBasis);
  if (
    evidence.reconciliation !== header.reconciliation ||
    evidence.statementHash !== header.statementHash ||
    recognition.occurredAt !== header.recognitionAt ||
    recognition.timezone !== header.statementTimezone ||
    recognition.statementPeriodEnd !== header.statementPeriodEnd ||
    basis.itemCount !== payable.length ||
    basis.itemHash !== itemHash ||
    lateBasis.itemCount !== excludedLate.length ||
    lateBasis.itemHash !== excludedLateHash ||
    safeSettlementMinor(basis.grossMinor) !== header.sourceGrossMinor
  )
    throw new Error('FINANCE_SETTLEMENT_SOURCE_STALE');
  const lineFacts: LineFact[] = lines.rows.map((line) => ({
    id: line.id,
    reconciliationItem: line.reconciliation_item_id,
    sourceType: line.source_type,
    sourceId: line.source_id,
    amountMinor: String(safeSettlementMinor(line.amount_minor)),
    invoiceMinor: String(safeSettlementMinor(line.invoice_minor, true)),
    taxMinor: String(safeSettlementMinor(line.tax_minor, true)),
    direction: line.direction,
    state: line.state,
    adjustmentOf: line.adjustment_of,
  }));
  if (lineFacts.some((line) => line.sourceType === 'payment.late.detected' || line.sourceType === 'payment.late.refunded')) {
    throw new Error('FINANCE_SETTLEMENT_SOURCE_NOT_SETTLEABLE');
  }
  const payableById = new Map(payable.map(({ item, reference }) => [item.id, String(reference)]));
  const baseLines = lineFacts.filter((line) => line.adjustmentOf === null);
  if (baseLines.length !== payable.length || baseLines.some((line) => payableById.get(line.reconciliationItem) !== line.sourceType)) throw new Error('FINANCE_SETTLEMENT_SOURCE_NOT_SETTLEABLE');
  const splitFacts: SplitFact[] = splits.rows.map((item) => ({
    id: item.id,
    beneficiaryType: item.beneficiary_type,
    beneficiaryId: item.beneficiary_id,
    amountMinor: String(safeSettlementMinor(item.amount_minor, true)),
    basisPoints: version(item.basis_points),
    state: item.state,
  }));
  const approved: AdjustmentFact[] = adjustments.rows
    .filter((item) => item.state === 'approved')
    .map((item) => ({
      id: item.id,
      settlementLine: item.settlement_line_id,
      direction: item.direction,
      amountMinor: String(safeSettlementMinor(item.amount_minor)),
      taxMinor: String(safeSettlementMinor(item.tax_minor, true)),
      requestedBy: item.requested_by,
      approvedBy: item.approved_by,
      version: version(item.version),
    }));
  if (header.version !== approved.length || lineFacts.length === 0 || lineFacts.some((line) => line.state !== 'frozen')) {
    throw new Error('FINANCE_SETTLEMENT_LINE_STALE');
  }
  assertAdjustmentLines(lineFacts, approved);
  const gross = signed(lineFacts, 'amountMinor');
  const invoice = signed(lineFacts, 'invoiceMinor');
  const calculated = new SettlementPolicy().split(gross, rule.rule);
  if (
    gross !== header.grossMinor ||
    calculated.feeMinor !== header.feeMinor ||
    calculated.netMinor !== header.netMinor ||
    calculated.invoiceBasis !== header.invoiceBasis ||
    invoice !== (header.invoiceBasis === 'gross' ? header.grossMinor : header.netMinor)
  ) {
    throw new Error('FINANCE_SETTLEMENT_CALCULATION_STALE');
  }
  const delta = approved.reduce((sum, item) => sum + (item.direction === 'decrease' ? -Number(item.amountMinor) : Number(item.amountMinor)), 0);
  if (header.sourceGrossMinor + delta !== header.grossMinor) throw new Error('FINANCE_SETTLEMENT_SOURCE_STALE');
  assertSplits(splitFacts, header, calculated.basisPoints);
  const lineHash = digest(canonical(lineFacts));
  const splitHash = digest(canonical(splitFacts));
  const adjustmentHash = digest(canonical(approved));
  const payload = {
    version: header.version,
    settlement: {
      id: header.id,
      scope: header.scope,
      partner: header.partner,
      reconciliation: header.reconciliation,
      currency: header.currency,
      grossMinor: String(header.grossMinor),
      feeMinor: String(header.feeMinor),
      netMinor: String(header.netMinor),
      invoiceBasis: header.invoiceBasis,
    },
    source: {
      statementHash: header.statementHash,
      recognitionAt: header.recognitionAt,
      statementTimezone: header.statementTimezone,
      statementPeriodEnd: header.statementPeriodEnd,
      reconciliationItemCount: payable.length,
      reconciliationItemHash: itemHash,
      excludedLateCount: excludedLate.length,
      excludedLateHash,
    },
    rule: { id: rule.id, version: rule.version, hash: rule.hash },
    calculation: { basisPoints: calculated.basisPoints, invoiceMinor: String(invoice) },
    lines: lineFacts,
    splits: splitFacts,
    adjustments: approved,
    hashes: { lineHash, splitHash, lineSplitHash: digest(`${lineHash}:${splitHash}`), adjustmentHash },
  } as const;
  return { header, evidence, snapshot: { ...payload, snapshotHash: digest(canonical(payload)) } };
}
function assertInitial(state: InternalState): void {
  const frozenRule = object(state.evidence.settlementRule);
  const lines = object(state.evidence.lineSnapshot);
  const calculation = object(state.evidence.calculation);
  const legacyHash = digest(state.snapshot.lines.map((line) => `${line.id}:${line.reconciliationItem}:${line.sourceType}:${line.sourceId}:${line.amountMinor}:${line.invoiceMinor}:${line.taxMinor}:${line.direction}`).join(','));
  const invoice = state.snapshot.lines.reduce((sum, line) => sum + Number(line.invoiceMinor), 0);
  if (
    frozenRule.id !== state.snapshot.rule.id ||
    frozenRule.version !== state.snapshot.rule.version ||
    frozenRule.hash !== state.snapshot.rule.hash ||
    lines.count !== state.snapshot.lines.length ||
    safeSettlementMinor(lines.net) !== state.header.grossMinor ||
    safeSettlementMinor(lines.invoice, true) !== invoice ||
    lines.hash !== legacyHash ||
    safeSettlementMinor(calculation.grossMinor) !== state.header.grossMinor ||
    safeSettlementMinor(calculation.feeMinor, true) !== state.header.feeMinor ||
    safeSettlementMinor(calculation.netMinor) !== state.header.netMinor ||
    calculation.invoiceBasis !== state.header.invoiceBasis
  ) {
    throw new Error('FINANCE_SETTLEMENT_SNAPSHOT_STALE');
  }
}
function assertAdjustmentLines(lines: readonly LineFact[], adjustments: readonly AdjustmentFact[]): void {
  const pending = new Map(adjustments.map((item) => [item.id, item]));
  for (const line of lines.filter((item) => item.sourceType === 'adjustment')) {
    const item = pending.get(line.sourceId);
    if (!item || line.adjustmentOf !== item.settlementLine || line.direction !== item.direction || line.amountMinor !== item.amountMinor || line.taxMinor !== item.taxMinor) throw new Error('FINANCE_SETTLEMENT_LINE_STALE');
    pending.delete(item.id);
  }
  if (pending.size) throw new Error('FINANCE_SETTLEMENT_LINE_STALE');
}
function assertSplits(splits: readonly SplitFact[], header: SettlementHeader, points: number): void {
  const partner = splits.filter((item) => item.beneficiaryType === 'partner');
  const platform = splits.filter((item) => item.beneficiaryType === 'platform');
  if (
    splits.some((item) => item.state !== 'frozen') ||
    partner.length !== 1 ||
    partner[0]!.beneficiaryId !== header.partner ||
    Number(partner[0]!.amountMinor) !== header.netMinor ||
    partner[0]!.basisPoints !== 10_000 - points ||
    platform.length > 1 ||
    (header.feeMinor > 0 && platform.length !== 1) ||
    (platform[0] !== undefined && (platform[0].beneficiaryId !== 'platform' || Number(platform[0].amountMinor) !== header.feeMinor || platform[0].basisPoints !== points)) ||
    splits.length !== partner.length + platform.length
  )
    throw new Error('FINANCE_SETTLEMENT_SPLIT_STALE');
}
function signed(lines: readonly LineFact[], field: 'amountMinor' | 'invoiceMinor'): number {
  const value = lines.reduce((sum, line) => sum + (line.direction === 'decrease' ? -Number(line[field]) : Number(line[field])), 0);
  if (!Number.isSafeInteger(value)) throw new Error('FINANCE_SETTLEMENT_AMOUNT_UNSAFE');
  return value;
}
// prettier-ignore
function sourceItem(item: ItemRow): string { return `${item.id}:${item.kind}:${item.internal_type ?? ''}:${item.internal_id ?? ''}:${safeSettlementMinor(item.internal_minor)}:${item.state}`; }
function version(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('FINANCE_SETTLEMENT_VERSION_INVALID');
  return result;
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function canonical(value: unknown): string {
  return JSON.stringify(stable(value));
}
// prettier-ignore
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,child]) => [key,stable(child)])); return value; }
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
// prettier-ignore
type Model = { HeaderRow:{id:string;scope_id:string;partner_id:string;reconciliation_id:string;currency:string;gross_minor:string;fee_minor:string;net_minor:string;invoice_basis:'gross'|'net';version:number;evidence:unknown;statement_hash:string;statement_period_end:string;statement_timezone:string;recognition_at:string}; RuleRow:{id:string;version:number;rule:unknown;hash:string}; ItemRow:{id:string;kind:string;internal_type:string|null;internal_id:string|null;internal_minor:string;state:string;reason_code:string|null;evidence:unknown}; LineRow:{id:string;reconciliation_item_id:string;source_type:string;source_id:string;amount_minor:string;invoice_minor:string;tax_minor:string;direction:'increase'|'decrease';state:string;adjustment_of:string|null}; SplitRow:{id:string;beneficiary_type:'partner'|'platform';beneficiary_id:string;amount_minor:string;basis_points:number;state:string}; AdjustmentRow:{id:string;settlement_line_id:string;direction:'increase'|'decrease';amount_minor:string;tax_minor:string;state:string;requested_by:string;approved_by:string|null;version:number}; Header:{id:string;scope:string;partner:string;reconciliation:string;currency:string;grossMinor:number;feeMinor:number;netMinor:number;invoiceBasis:'gross'|'net';version:number;statementHash:string;recognitionAt:string;statementTimezone:string;statementPeriodEnd:string;sourceGrossMinor:number}; Line:{id:string;reconciliationItem:string;sourceType:string;sourceId:string;amountMinor:string;invoiceMinor:string;taxMinor:string;direction:'increase'|'decrease';state:string;adjustmentOf:string|null}; Split:{id:string;beneficiaryType:'partner'|'platform';beneficiaryId:string;amountMinor:string;basisPoints:number;state:string}; Adjustment:{id:string;settlementLine:string;direction:'increase'|'decrease';amountMinor:string;taxMinor:string;requestedBy:string;approvedBy:string|null;version:number} };
type HeaderRow = Model['HeaderRow'];
type RuleRow = Model['RuleRow'];
type ItemRow = Model['ItemRow'];
type LineRow = Model['LineRow'];
type SplitRow = Model['SplitRow'];
type AdjustmentRow = Model['AdjustmentRow'];
type SettlementHeader = Model['Header'];
type LineFact = Model['Line'];
type SplitFact = Model['Split'];
type AdjustmentFact = Model['Adjustment'];
type SettlementSnapshot = { version: number; rule: { id: string; version: number; hash: string }; lines: readonly LineFact[]; splits: readonly SplitFact[]; adjustments: readonly AdjustmentFact[]; snapshotHash: string } & Record<
  string,
  unknown
>;
type InternalState = SettlementSnapshotState & { readonly evidence: Record<string, unknown>; readonly snapshot: SettlementSnapshot };
