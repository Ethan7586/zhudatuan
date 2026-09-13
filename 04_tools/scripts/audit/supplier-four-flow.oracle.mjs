import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const runDirectory = option('--run-directory');
const criteriaPath = option('--criteria');
const outputPath = option('--output');
const inputNames = Object.freeze(['supplier-route-snapshot.json', 'four-flow-forward-facts.json', 'partial-refund-replay.json', 'environment.json']);
const [criteria, route, forward, replay, environment] = await Promise.all([
  readJson(criteriaPath),
  readJson(join(runDirectory, inputNames[0])),
  readJson(join(runDirectory, inputNames[1])),
  readJson(join(runDirectory, inputNames[2])),
  readJson(join(runDirectory, inputNames[3])),
]);

const missingItems = requiredEvidence(criteria, route, forward, replay, environment);
const baseline = reconcile(criteria, route, forward, replay);
const negativeProbes = runNegativeProbes(criteria, route, forward, replay);
const thresholds = Object.freeze([
  threshold('required_raw_evidence_missing_count', missingItems.length),
  threshold('topology_mismatch_count', baseline.counts.topology),
  threshold('money_difference_minor', baseline.counts.money),
  threshold('payment_mismatch_count', baseline.counts.payment),
  threshold('four_flow_authority_mismatch_count', baseline.counts.authority),
  threshold('inventory_quantity_mismatch_count', baseline.counts.inventory),
  threshold('forward_finance_mismatch_count', baseline.counts.forwardFinance),
  threshold('refund_original_target_mismatch_count', baseline.counts.refund),
  threshold('reversal_finance_mismatch_count', baseline.counts.reversalFinance),
  threshold('duplicate_replay_business_fact_count', baseline.counts.duplicate),
  threshold('historical_route_version_change_count', baseline.counts.history),
  threshold('atomic_failure_half_write_count', baseline.counts.atomic),
  threshold('negative_oracle_probe_miss_count', negativeProbes.filter((entry) => !entry.detected).length),
]);
const contradictionCount = thresholds.filter((entry) => entry.threshold_id !== 'required_raw_evidence_missing_count').reduce((total, entry) => total + entry.actual, 0);
const claimOutcome = missingItems.length > 0 ? 'UNKNOWN' : contradictionCount > 0 ? 'NOT MET' : 'MET';
const inputArtifacts = await Promise.all(
  [criteriaPath, ...inputNames.map((name) => join(runDirectory, name))].map(async (path) => {
    const bytes = await readFile(path);
    return Object.freeze({ path: basename(path), sha256: `sha256:${sha256(bytes)}`, size_bytes: bytes.byteLength });
  })
);
const output = Object.freeze({
  schema_version: 'e08-independent-reconciliation-v1',
  oracle_id: criteria.independent_oracle.oracle_id,
  executed_at: new Date().toISOString(),
  reads_test_program_pass: false,
  input_artifacts: inputArtifacts,
  missing_items: missingItems,
  violations: baseline.violations,
  negative_probes: negativeProbes,
  thresholds,
  claim_outcome: claimOutcome,
  environment_assurance: claimOutcome === 'MET' && environment.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED',
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });

function requiredEvidence(criteriaValue, routeValue, forwardValue, replayValue, environmentValue) {
  const missing = [];
  requireObject(criteriaValue.expected_fixture, 'criteria expected_fixture', missing);
  requireObject(routeValue.order, 'authoritative order row', missing);
  for (const [value, name] of [
    [routeValue.lines, 'authoritative order line rows'],
    [routeValue.supplier_legs, 'authoritative supplier leg rows'],
    [routeValue.line_route_steps, 'original line route rows'],
    [routeValue.relationship_versions, 'original/current relationship versions'],
    [routeValue.contract_versions, 'original/current contract versions'],
    [forwardValue.inventory_reservation_facts, 'inventory reservation ledger'],
    [forwardValue.fulfillment_responsibilities, 'fulfillment responsibility facts'],
    [forwardValue.payment_intents, 'payment intent rows'],
    [forwardValue.payments, 'payment rows'],
    [forwardValue.captures, 'payment capture rows'],
    [forwardValue.payment_allocations, 'payment allocation rows'],
    [forwardValue.merchant_receipts, 'merchant receipt rows'],
    [forwardValue.finance_facts, 'forward finance facts'],
    [replayValue.aftersales, 'aftersale rows'],
    [replayValue.refunds, 'refund rows'],
    [replayValue.refund_allocations, 'refund allocation rows'],
    [replayValue.reverse_route_steps, 'reverse route rows'],
    [replayValue.return_facts, 'supplier return facts'],
    [replayValue.restock_facts, 'inventory restock facts'],
    [replayValue.finance_reversals, 'finance reversal facts'],
  ])
    requireNonEmptyArray(value, name, missing);
  requireObject(replayValue.concurrent_counts, 'concurrent replay counts', missing);
  requireObject(replayValue.atomic_failure_probe_counts, 'atomic failure probe counts', missing);
  for (const [value, name] of [
    [environmentValue.kind, 'environment kind'],
    [environmentValue.environment_id, 'environment identity'],
    [environmentValue.runtime?.postgres, 'PostgreSQL runtime version'],
    [environmentValue.source_control?.sha, 'source commit SHA'],
    [environmentValue.configuration_digest, 'configuration digest'],
  ])
    if (value === undefined || value === null || value === '') missing.push(name);
  return Object.freeze([...new Set(missing)].sort());
}

function reconcile(criteriaValue, routeValue, forwardValue, replayValue) {
  const expected = criteriaValue.expected_fixture ?? {};
  const counts = { topology: 0, money: 0, payment: 0, authority: 0, inventory: 0, forwardFinance: 0, refund: 0, reversalFinance: 0, duplicate: 0, history: 0, atomic: 0 };
  const violations = [];
  const add = (category, code, detail, weight = 1) => {
    counts[category] += Math.abs(number(weight));
    violations.push(Object.freeze({ category, code, detail }));
  };
  const order = routeValue.order ?? {};
  const lines = array(routeValue.lines);
  const legs = array(routeValue.supplier_legs);
  const lineMap = byId(lines);
  const legMap = byId(legs);

  mismatch(lines.length, expected.order_line_count, 'topology', 'ORDER_LINE_COUNT', add);
  mismatch(legs.length, expected.supplier_leg_count, 'topology', 'SUPPLIER_LEG_COUNT', add);
  mismatch(new Set(lines.map((row) => row.supplier_leg_id)).size, expected.supplier_leg_count, 'topology', 'LINE_LEG_CARDINALITY', add);
  money(sum(lines, 'total_minor'), expected.gross_minor, 'LINE_GROSS', add);
  money(sum(lines, 'discount_minor'), expected.discount_minor, 'LINE_DISCOUNT', add);
  money(
    sum(lines, (row) => number(row.total_minor) - number(row.discount_minor)),
    order.total_minor,
    'LINE_PAYABLE_TO_ORDER',
    add
  );
  money(sum(legs, 'merchandise_minor'), expected.gross_minor, 'LEG_GROSS', add);
  money(sum(legs, 'discount_minor'), expected.discount_minor, 'LEG_DISCOUNT', add);
  money(sum(legs, 'amount_minor'), order.total_minor, 'LEG_PAYABLE_TO_ORDER', add);
  if (order.currency !== expected.currency) add('topology', 'ORDER_CURRENCY', { actual: order.currency, expected: expected.currency });

  for (const line of lines) {
    const leg = legMap.get(line.supplier_leg_id);
    if (!leg) {
      add('authority', 'LINE_LEG_MISSING', { line_id: line.id, supplier_leg_id: line.supplier_leg_id });
      continue;
    }
    compareFields(line, leg, ['supplier_id', 'supplier_relationship_id', 'contract_id', 'route_id', 'route_version'], 'authority', 'LINE_LEG', add);
    money(number(line.total_minor) - number(line.discount_minor), leg.amount_minor, `LINE_LEG_PAYABLE:${line.id}`, add);
  }

  const allocations = array(forwardValue.payment_allocations);
  money(sum(allocations, 'amount_minor'), order.total_minor, 'PAYMENT_ALLOCATION_TOTAL', add);
  mismatch(allocations.length, expected.supplier_leg_count, 'payment', 'PAYMENT_ALLOCATION_COUNT', add);
  for (const allocation of allocations) {
    const leg = legMap.get(allocation.target_id);
    if (!leg || allocation.target_type !== 'supplier_economic_leg' || number(allocation.amount_minor) !== number(leg?.amount_minor) || allocation.currency !== expected.currency) {
      add('payment', 'PAYMENT_ALLOCATION_LEG_MISMATCH', { allocation, supplier_leg: leg ?? null });
    }
  }
  for (const [rows, amountField, code] of [
    [forwardValue.payment_intents, 'amount_minor', 'PAYMENT_INTENT'],
    [forwardValue.payments, 'captured_minor', 'PAYMENT_CAPTURED'],
    [forwardValue.captures, 'amount_minor', 'CAPTURE'],
    [forwardValue.merchant_receipts, 'amount_minor', 'MERCHANT_RECEIPT'],
  ]) {
    const values = array(rows);
    if (values.length !== 1 || number(values[0]?.[amountField]) !== number(order.total_minor) || values[0]?.currency !== expected.currency) add('payment', `${code}_MISMATCH`, { rows: values });
  }

  checkForwardAuthority(forwardValue, lineMap, legMap, order, expected, add);
  checkForwardFinance(forwardValue, legMap, expected, add);
  checkRefunds(replayValue, routeValue, lineMap, legMap, order, expected, add);
  checkHistory(routeValue, replayValue, lineMap, expected, add);
  checkDuplicates(replayValue, expected, add);
  for (const [name, value] of Object.entries(replayValue.atomic_failure_probe_counts ?? {})) {
    if (number(value) !== 0) add('atomic', 'ATOMIC_HALF_WRITE', { name, actual: value }, value);
  }
  return Object.freeze({ counts: Object.freeze(counts), violations: Object.freeze(violations) });
}

function checkForwardAuthority(forward, lineMap, legMap, order, expected, add) {
  const reservations = array(forward.inventory_reservation_facts);
  const responsibilities = array(forward.fulfillment_responsibilities);
  mismatch(reservations.length, expected.supplier_leg_count, 'inventory', 'RESERVATION_FACT_COUNT', add);
  mismatch(responsibilities.length, expected.supplier_leg_count, 'authority', 'FULFILLMENT_FACT_COUNT', add);
  for (const fact of reservations) {
    const line = lineMap.get(fact.order_line_id);
    const leg = legMap.get(fact.supplier_leg_id);
    if (
      !line ||
      !leg ||
      line.supplier_leg_id !== fact.supplier_leg_id ||
      number(line.quantity) !== number(fact.quantity) ||
      !sameAuthority(fact, line) ||
      fact.transaction_id !== order.transaction_id ||
      fact.correlation_id !== order.correlation_id
    ) {
      add('inventory', 'RESERVATION_LINE_LEG_MISMATCH', { fact, line: line ?? null, leg: leg ?? null });
    }
  }
  for (const fact of responsibilities) {
    const leg = legMap.get(fact.supplier_leg_id);
    if (
      !leg ||
      !sameAuthority(fact, leg) ||
      fact.transaction_id !== order.transaction_id ||
      fact.correlation_id !== order.correlation_id ||
      fact.fulfillment_party_id !== leg.fulfillment_party_id ||
      fact.settlement_party_id !== leg.settlement_party_id ||
      fact.invoice_party_id !== leg.invoice_party_id
    ) {
      add('authority', 'FULFILLMENT_LEG_MISMATCH', { fact, supplier_leg: leg ?? null });
    }
  }
}

function checkForwardFinance(forward, legMap, expected, add) {
  const facts = array(forward.finance_facts);
  const expectedKinds = [...(expected.forward_finance_kinds ?? [])].sort();
  for (const leg of legMap.values()) {
    const legFacts = facts.filter((fact) => fact.supplier_leg_id === leg.id);
    const kinds = legFacts.map((fact) => fact.fact_kind).sort();
    if (JSON.stringify(kinds) !== JSON.stringify(expectedKinds)) {
      add('forwardFinance', 'FORWARD_FINANCE_KIND_SET', { supplier_leg_id: leg.id, actual: kinds, expected: expectedKinds });
    }
    for (const fact of legFacts) {
      const expectedAmount = ['receivable', 'income'].includes(fact.fact_kind) ? leg.amount_minor : leg.cost_minor;
      if (number(fact.amount_minor) !== number(expectedAmount) || fact.currency !== expected.currency || !sameAuthority(fact, leg)) {
        add('forwardFinance', 'FORWARD_FINANCE_FACT_MISMATCH', { fact, expected_amount_minor: expectedAmount });
      }
    }
  }
  const knownLegFacts = facts.filter((fact) => legMap.has(fact.supplier_leg_id));
  if (knownLegFacts.length !== facts.length) add('forwardFinance', 'FORWARD_FINANCE_UNKNOWN_LEG', { count: facts.length - knownLegFacts.length });
}

function checkRefunds(replay, route, lineMap, legMap, order, expected, add) {
  const aftersales = array(replay.aftersales);
  const refunds = array(replay.refunds);
  const allocations = array(replay.refund_allocations);
  const returns = array(replay.return_facts);
  const restocks = array(replay.restock_facts);
  const reversals = array(replay.finance_reversals);
  const expectedIds = [...(expected.selected_aftersales ?? [])].sort();
  const actualIds = aftersales
    .filter((row) => row.order_id === expected.order_id)
    .map((row) => row.id)
    .sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) add('refund', 'AFTERSALE_SET_MISMATCH', { actual: actualIds, expected: expectedIds });
  for (const aftersale of aftersales.filter((row) => expectedIds.includes(row.id))) {
    const line = lineMap.get(aftersale.line_id);
    const leg = legMap.get(aftersale.supplier_leg_id);
    const refund = refunds.find((row) => row.aftersale_id === aftersale.id);
    const allocationRows = allocations.filter((row) => row.aftersale_id === aftersale.id);
    const returnRows = returns.filter((row) => row.aftersale_id === aftersale.id);
    const restockRows = restocks.filter((row) => row.aftersale_id === aftersale.id);
    const reversalRows = reversals.filter((row) => row.aftersale_id === aftersale.id);
    if (!line || !leg || line.supplier_leg_id !== aftersale.supplier_leg_id) {
      add('refund', 'AFTERSALE_ORIGINAL_LINE_LEG_MISMATCH', { aftersale, line: line ?? null, leg: leg ?? null });
    }
    if (!refund || number(refund.amount_minor) !== number(aftersale.amount_minor) || refund.currency !== expected.currency) {
      add('refund', 'REFUND_AFTERSALE_AMOUNT_MISMATCH', { aftersale, refund: refund ?? null });
    }
    if (
      allocationRows.length !== 1 ||
      allocationRows[0]?.order_line_id !== aftersale.line_id ||
      allocationRows[0]?.supplier_leg_id !== aftersale.supplier_leg_id ||
      allocationRows[0]?.route_id !== line?.route_id ||
      number(allocationRows[0]?.route_version) !== number(line?.route_version) ||
      number(allocationRows[0]?.amount_minor) !== number(aftersale.amount_minor)
    ) {
      add('refund', 'REFUND_ALLOCATION_ORIGINAL_LEG_MISMATCH', { aftersale, allocations: allocationRows });
    }
    if (
      returnRows.length !== 1 ||
      restockRows.length !== 1 ||
      returnRows[0]?.order_line_id !== aftersale.line_id ||
      returnRows[0]?.supplier_leg_id !== aftersale.supplier_leg_id ||
      restockRows[0]?.order_line_id !== aftersale.line_id ||
      restockRows[0]?.supplier_leg_id !== aftersale.supplier_leg_id ||
      number(returnRows[0]?.quantity) !== number(aftersale.quantity) ||
      number(restockRows[0]?.quantity) !== number(aftersale.quantity)
    ) {
      add('inventory', 'RETURN_RESTOCK_ORIGINAL_TARGET_MISMATCH', { aftersale, returns: returnRows, restocks: restockRows });
    }
    const expectedCost = line ? (number(leg?.cost_minor) * number(aftersale.quantity)) / number(line.quantity) : Number.NaN;
    const expectedKinds = [...(expected.forward_finance_kinds ?? [])].sort();
    if (JSON.stringify(reversalRows.map((row) => row.fact_kind).sort()) !== JSON.stringify(expectedKinds)) {
      add('reversalFinance', 'REVERSAL_FINANCE_KIND_SET', { aftersale_id: aftersale.id });
    }
    for (const fact of reversalRows) {
      const expectedAmount = ['receivable', 'income'].includes(fact.fact_kind) ? aftersale.amount_minor : expectedCost;
      if (
        number(fact.amount_minor) !== number(expectedAmount) ||
        fact.currency !== expected.currency ||
        fact.order_line_id !== aftersale.line_id ||
        fact.supplier_leg_id !== aftersale.supplier_leg_id ||
        fact.transaction_id !== order.transaction_id ||
        fact.correlation_id !== order.correlation_id
      ) {
        add('reversalFinance', 'REVERSAL_FINANCE_FACT_MISMATCH', { fact, expected_amount_minor: expectedAmount });
      }
    }
  }
  const unaffected = expected.unaffected_order_line;
  if (
    aftersales.some((row) => row.line_id === unaffected) ||
    allocations.some((row) => row.order_line_id === unaffected) ||
    restocks.some((row) => row.order_line_id === unaffected) ||
    reversals.some((row) => row.order_line_id === unaffected)
  ) {
    add('refund', 'UNAFFECTED_LINE_REVERSED', { order_line_id: unaffected });
  }
}

function checkHistory(route, replay, lineMap, expected, add) {
  const change = expected.relationship_change ?? {};
  const line = array(route.lines).find((row) => row.supplier_relationship_id === change.relationship_id);
  const relationships = array(route.relationship_versions).filter((row) => row.relationship_id === change.relationship_id);
  const contracts = array(route.contract_versions).filter((row) => row.contract_id === change.contract_id);
  const currentRelationship = relationships.find((row) => number(row.relationship_version) === number(change.current_version));
  const currentContract = contracts.find((row) => number(row.contract_version) === number(change.current_contract_version));
  if (!line || number(line.supplier_relationship_version) !== number(change.frozen_version) || number(line.contract_version) !== number(change.frozen_contract_version) || !currentRelationship || !currentContract) {
    add('history', 'FROZEN_AND_CURRENT_VERSION_BASELINE_MISMATCH', { line: line ?? null, current_relationship: currentRelationship ?? null, current_contract: currentContract ?? null });
  }
  const expectedLevels = expected.route_levels ?? [];
  for (const candidate of array(route.lines)) {
    const steps = array(route.line_route_steps)
      .filter((row) => row.order_line_id === candidate.id)
      .sort(by('sequence_no'));
    if (
      JSON.stringify(steps.map((row) => row.signed_level)) !== JSON.stringify(expectedLevels) ||
      steps.some(
        (row) =>
          row.route_id !== candidate.route_id ||
          number(row.route_version) !== number(candidate.route_version) ||
          number(row.supplier_relationship_version) !== number(candidate.supplier_relationship_version) ||
          number(row.contract_version) !== number(candidate.contract_version)
      )
    ) {
      add('history', 'HISTORICAL_ROUTE_STEP_MISMATCH', { order_line_id: candidate.id, steps });
    }
  }
  for (const aftersale of array(replay.aftersales)) {
    if (!(expected.selected_aftersales ?? []).includes(aftersale.id)) continue;
    const sourceLine = lineMap.get(aftersale.line_id);
    const reverse = array(replay.reverse_route_steps)
      .filter((row) => row.aftersale_id === aftersale.id)
      .sort(by('reverse_sequence_no'));
    const original = array(route.line_route_steps).filter((row) => row.order_line_id === aftersale.line_id);
    const expectedSequence = [...original].sort((a, b) => number(b.sequence_no) - number(a.sequence_no));
    if (
      reverse.length !== expectedSequence.length ||
      reverse.some(
        (row, index) =>
          row.original_sequence_no !== expectedSequence[index]?.sequence_no || row.route_id !== sourceLine?.route_id || number(row.route_version) !== number(sourceLine?.route_version) || row.party_id !== expectedSequence[index]?.party_id
      )
    ) {
      add('history', 'REVERSE_ROUTE_NOT_ORIGINAL', { aftersale_id: aftersale.id, reverse });
    }
  }
}

function checkDuplicates(replay, expected, add) {
  for (const [rows, key, code] of [
    [replay.refunds, (row) => row.idempotency_key, 'DUPLICATE_REFUND'],
    [replay.refund_allocations, (row) => `${row.aftersale_id}:${row.order_line_id}`, 'DUPLICATE_REFUND_ALLOCATION'],
    [replay.restock_facts, (row) => `${row.aftersale_id}:${row.order_line_id}`, 'DUPLICATE_RESTOCK'],
    [replay.finance_reversals, (row) => `${row.aftersale_id}:${row.order_line_id}:${row.fact_kind}`, 'DUPLICATE_REVERSAL'],
    [replay.reverse_route_steps, (row) => `${row.aftersale_id}:${row.order_line_id}:${row.reverse_sequence_no}`, 'DUPLICATE_REVERSE_STEP'],
  ]) {
    const duplicates = duplicateKeys(array(rows), key);
    if (duplicates.length > 0) add('duplicate', code, { keys: duplicates }, duplicates.length);
  }
  const expectedCounts = expected.concurrent_expected_counts ?? {};
  for (const [name, expectedValue] of Object.entries(expectedCounts)) {
    const actual = number(replay.concurrent_counts?.[name]);
    if (actual !== number(expectedValue)) add('duplicate', 'CONCURRENT_REPLAY_COUNT', { name, actual, expected: expectedValue }, Math.abs(actual - number(expectedValue)) || 1);
  }
  if (number(replay.replay_attempts) !== number(expected.concurrent_replay_attempts)) {
    add('duplicate', 'CONCURRENT_REPLAY_ATTEMPTS', { actual: replay.replay_attempts, expected: expected.concurrent_replay_attempts });
  }
}

function runNegativeProbes(criteria, route, forward, replay) {
  const probes = [];
  const crossLeg = structuredClone(replay);
  if (crossLeg.refund_allocations?.[0]) crossLeg.refund_allocations[0].supplier_leg_id = criteria.expected_fixture.unaffected_order_line.replace('line:', 'leg:');
  probes.push(probe('cross_leg_refund', reconcile(criteria, route, forward, crossLeg), 'REFUND_ALLOCATION_ORIGINAL_LEG_MISMATCH'));
  const duplicate = structuredClone(replay);
  if (duplicate.refund_allocations?.[0]) duplicate.refund_allocations.push({ ...duplicate.refund_allocations[0], id: 'oracle:duplicate-refund-allocation' });
  probes.push(probe('duplicate_refund', reconcile(criteria, route, forward, duplicate), 'DUPLICATE_REFUND_ALLOCATION'));
  const rewritten = structuredClone(route);
  const change = criteria.expected_fixture.relationship_change;
  const rewrittenLine = rewritten.lines?.find((row) => row.supplier_relationship_id === change.relationship_id);
  if (rewrittenLine) rewrittenLine.supplier_relationship_version = change.current_version;
  probes.push(probe('current_route_historical_rewrite', reconcile(criteria, rewritten, forward, replay), 'HISTORICAL_ROUTE_STEP_MISMATCH'));
  return Object.freeze(probes);
}

function probe(probeId, result, expectedCode) {
  const detectedCodes = result.violations.map((entry) => entry.code);
  return Object.freeze({ probe_id: probeId, expected_violation: expectedCode, detected: detectedCodes.includes(expectedCode), detected_codes: [...new Set(detectedCodes)].sort() });
}

function compareFields(left, right, fields, category, prefix, add) {
  for (const field of fields) if (left[field] !== right[field]) add(category, `${prefix}_${field.toUpperCase()}_MISMATCH`, { left: left[field], right: right[field] });
}

function sameAuthority(left, right) {
  return left.supplier_leg_id === undefined || right.id === left.supplier_leg_id || left.supplier_leg_id === right.supplier_leg_id
    ? left.supplier_id === right.supplier_id && left.route_id === right.route_id && number(left.route_version) === number(right.route_version)
    : false;
}

function mismatch(actual, expected, category, code, add) {
  if (number(actual) !== number(expected)) add(category, code, { actual, expected }, Math.abs(number(actual) - number(expected)) || 1);
}

function money(actual, expected, code, add) {
  const difference = number(actual) - number(expected);
  if (difference !== 0) add('money', code, { actual, expected, difference_minor: difference }, difference);
}

function duplicateKeys(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function threshold(thresholdId, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected: 0, actual, met: actual === 0 });
}

function byId(rows) {
  return new Map(rows.map((row) => [row.id, row]));
}
function array(value) {
  return Array.isArray(value) ? value : [];
}
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function sum(rows, field) {
  return array(rows).reduce((total, row) => total + number(typeof field === 'function' ? field(row) : row[field]), 0);
}
function by(field) {
  return (left, right) => number(left[field]) - number(right[field]);
}
function requireObject(value, name, missing) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) missing.push(name);
}
function requireNonEmptyArray(value, name, missing) {
  if (!Array.isArray(value) || value.length === 0) missing.push(name);
}
function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function option(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`SUPPLIER_FOUR_FLOW_OPTION_REQUIRED:${name}`);
  return value;
}
