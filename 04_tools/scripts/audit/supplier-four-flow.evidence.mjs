import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const testsRoot = join(repositoryRoot, '02_platform_pingtai', 'database', 'supabase', 'tests');
export const businessContractPath = join(testsRoot, 'supplier_four_flow_business_contract.sql');
export const replayContractPath = join(testsRoot, 'supplier_four_flow_concurrent_replay.sql');

export async function materializeBusinessFixture(database, criteria) {
  const source = await verifiedContract(businessContractPath, criteria);
  if (!/^begin;\s/i.test(source) || !/\nrollback;\s*$/i.test(source)) {
    throw new Error('E08_BUSINESS_CONTRACT_TRANSACTION_BOUNDARY_INVALID');
  }
  const executable = source.replace(/\nrollback;\s*$/i, '\ncommit;\n');
  await database.query(executable);
  return Object.freeze({
    source_sha256: `sha256:${sha256(source)}`,
    execution_transform: 'Only the terminal cleanup ROLLBACK was changed to COMMIT inside the disposable database so replay sessions and evidence queries could read the synthetic baseline.',
  });
}

export async function verifiedReplayContract(criteria) {
  return verifiedContract(replayContractPath, criteria);
}

export async function collectSupplierFourFlowEvidence(database, criteria, replayAttempts, capturedAt) {
  const orderId = criteria.expected_fixture.order_id;
  const [orderResult, lines, legs, lineRouteSteps, relationshipVersions, contractVersions] = await Promise.all([
    query(
      database,
      `select id,order_number,total_minor,currency,transaction_id,correlation_id,operating_node_id,operating_line_id,
      participant_node_id,participant_membership_id,participant_realm_id,participant_account_id
      from ordering.orderrecord where id=$1`,
      [orderId]
    ),
    query(
      database,
      `select id,order_id,supplier_leg_id,quantity,total_minor,discount_minor,supplier_id,supplier_relationship_id,
      supplier_relationship_version,contract_id,contract_version,fulfillment_party_id,settlement_party_id,invoice_party_id,
      route_id,route_version,stockitem_id
      from ordering.line where order_id=$1 order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,order_id,supplier_id,supplier_relationship_id,contract_id,route_id,route_version,
      fulfillment_party_id,settlement_party_id,invoice_party_id,amount_minor,merchandise_minor,discount_minor,shipping_minor,
      tax_minor,cost_minor,currency,transaction_id,correlation_id,realm_id,line_id,operating_node_id
      from ordering.suborder where order_id=$1 order by id`,
      [orderId]
    ),
    query(
      database,
      `select order_line_id,route_id,route_version,sequence_no,line_id,signed_level,node_id,party_id,party_kind,
      supplier_id,supplier_relationship_id,supplier_relationship_version,contract_id,contract_version,edge_kind,
      fulfillment_party_id,settlement_party_id,invoice_party_id
      from ordering.lineroutestep where order_line_id in(select id from ordering.line where order_id=$1)
      order by order_line_id,sequence_no`,
      [orderId]
    ),
    query(
      database,
      `select id,relationship_id,relationship_version,supplier_id,purchasing_node_id,realm_id,line_id,mall_id,
      status,effective_at,superseded_at,predecessor_id
      from partner.supplierrelationship where relationship_id like 'relationship:test:%'
      order by relationship_id,relationship_version`
    ),
    query(
      database,
      `select id,contract_id,contract_version,supplier_relationship_id,fulfillment_party_id,settlement_party_id,
      invoice_party_id,status,effective_at,superseded_at,predecessor_id
      from partner.suppliercontract where contract_id like 'contract:test:%'
      order by contract_id,contract_version`
    ),
  ]);
  const route = Object.freeze({
    schema_version: 'e08-supplier-route-snapshot-v1',
    captured_at: capturedAt,
    order: orderResult[0] ?? null,
    lines,
    supplier_legs: legs,
    line_route_steps: lineRouteSteps,
    relationship_versions: relationshipVersions,
    contract_versions: contractVersions,
  });

  const [inventoryReservations, responsibilities, intents, payments, captures, allocations, receipts, financeFacts] = await Promise.all([
    query(
      database,
      `select id,reservation_id,order_id,order_line_id,supplier_leg_id,stockitem_id,transaction_id,correlation_id,
      route_id,route_version,supplier_id,quantity,state from inventory.supplierreservationfact where order_id=$1 order by order_line_id`,
      [orderId]
    ),
    query(
      database,
      `select id,order_id,supplier_leg_id,transaction_id,correlation_id,route_id,route_version,supplier_id,
      fulfillment_party_id,settlement_party_id,invoice_party_id,state
      from fulfillment.supplierresponsibility where order_id=$1 order by supplier_leg_id`,
      [orderId]
    ),
    query(
      database,
      `select id,order_id,currency,amount_minor,state,idempotency_key,provider_reference
      from payment.intent where order_id=$1 order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state
      from payment.payment where intent_id in(select id from payment.intent where order_id=$1) order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,order_id,currency,amount_minor,state,idempotency_key
      from payment.capture where order_id=$1 order by id`,
      [orderId]
    ),
    query(
      database,
      `select payment_id,target_type,target_id,amount_minor,currency
      from payment.allocation where target_type='supplier_economic_leg'
      and target_id in(select id from ordering.suborder where order_id=$1) order by target_id`,
      [orderId]
    ),
    query(
      database,
      `select id,payment_id,order_id,transaction_id,correlation_id,amount_minor,currency,provider_source
      from payment.merchantreceipt where order_id=$1 order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,order_id,supplier_leg_id,transaction_id,correlation_id,route_id,route_version,supplier_id,
      fact_kind,amount_minor,currency from finance.supplierlegfact where order_id=$1 order by supplier_leg_id,fact_kind`,
      [orderId]
    ),
  ]);
  const forward = Object.freeze({
    schema_version: 'e08-four-flow-forward-facts-v1',
    captured_at: capturedAt,
    inventory_reservation_facts: inventoryReservations,
    fulfillment_responsibilities: responsibilities,
    payment_intents: intents,
    payments,
    captures,
    payment_allocations: allocations,
    merchant_receipts: receipts,
    finance_facts: financeFacts,
  });

  const [aftersales, refunds, refundAllocations, reverseRouteSteps, returnFacts, restockFacts, financeReversals, concurrentCounts, atomicCounts] = await Promise.all([
    query(
      database,
      `select id,order_id,line_id,kind,state,quantity,amount_minor,requested_membership_id,supplier_leg_id,
      replay_state from ordering.aftersale where order_id in($1,'order:test:concurrent') order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,payment_id,idempotency_key,amount_minor,currency,state,aftersale_id
      from payment.refund where aftersale_id in(select id from ordering.aftersale where order_id in($1,'order:test:concurrent')) order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,refund_id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,route_id,
      route_version,supplier_id,amount_minor,currency,state from payment.supplierrefundallocation
      where aftersale_id in(select id from ordering.aftersale where order_id in($1,'order:test:concurrent')) order by id`,
      [orderId]
    ),
    query(
      database,
      `select aftersale_id,order_line_id,reverse_sequence_no,original_sequence_no,route_id,route_version,party_id,
      party_kind,responsibility from ordering.aftersaleroutestep
      where aftersale_id in(select id from ordering.aftersale where order_id in($1,'order:test:concurrent'))
      order by aftersale_id,reverse_sequence_no`,
      [orderId]
    ),
    query(
      database,
      `select id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,route_id,route_version,
      fulfillment_party_id,quantity,state from fulfillment.supplierreturnfact
      where aftersale_id in(select id from ordering.aftersale where order_id in($1,'order:test:concurrent')) order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,aftersale_id,order_line_id,supplier_leg_id,stockitem_id,transaction_id,correlation_id,route_id,
      route_version,quantity from inventory.supplierrestockfact
      where aftersale_id in(select id from ordering.aftersale where order_id in($1,'order:test:concurrent')) order by id`,
      [orderId]
    ),
    query(
      database,
      `select id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,fact_kind,amount_minor,currency
      from finance.supplierlegreversal where aftersale_id in(select id from ordering.aftersale where order_id in($1,'order:test:concurrent'))
      order by aftersale_id,fact_kind`,
      [orderId]
    ),
    query(
      database,
      `select
      (select count(*)::integer from ordering.orderrecord where id='order:test:concurrent') order_records,
      (select count(*)::integer from ordering.line where id='line:test:concurrent') order_lines,
      (select count(*)::integer from ordering.suborder where id='leg:test:concurrent') supplier_legs,
      (select count(*)::integer from ordering.aftersale where id='aftersale:test:concurrent') aftersales,
      (select count(*)::integer from ordering.lineroutestep where order_line_id='line:test:concurrent') line_route_steps,
      (select count(*)::integer from ordering.aftersaleroutestep where aftersale_id='aftersale:test:concurrent') reverse_route_steps,
      (select count(*)::integer from payment.refund where id='refund:test:concurrent') refunds,
      (select count(*)::integer from payment.supplierrefundallocation where aftersale_id='aftersale:test:concurrent') refund_allocations,
      (select count(*)::integer from inventory.supplierrestockfact where aftersale_id='aftersale:test:concurrent') restock_facts,
      (select count(*)::integer from finance.supplierlegreversal where aftersale_id='aftersale:test:concurrent') finance_reversals`
    ),
    query(
      database,
      `select
      (select count(*)::integer from ordering.orderrecord where id='order:test:rolled-back') order_half_writes,
      (select count(*)::integer from ordering.aftersaleexception where id='exception:test:inventory-rollback') inventory_half_writes,
      (select count(*)::integer from ordering.aftersaleexception where id='exception:test:refund-rollback') refund_half_writes`
    ),
  ]);
  const replay = Object.freeze({
    schema_version: 'e08-partial-refund-replay-v1',
    captured_at: capturedAt,
    replay_attempts: replayAttempts,
    aftersales,
    refunds,
    refund_allocations: refundAllocations,
    reverse_route_steps: reverseRouteSteps,
    return_facts: returnFacts,
    restock_facts: restockFacts,
    finance_reversals: financeReversals,
    concurrent_counts: concurrentCounts[0] ?? null,
    atomic_failure_probe_counts: atomicCounts[0] ?? null,
  });
  return Object.freeze({ route, forward, replay });
}

async function verifiedContract(path, criteria) {
  const source = await readFile(path, 'utf8');
  const repositoryPath = path.slice(repositoryRoot.length + 1).replaceAll('\\', '/');
  const expected = criteria.fixture_contracts.find((entry) => entry.path === repositoryPath)?.sha256;
  const actual = `sha256:${sha256(source)}`;
  if (expected === undefined || expected !== actual) throw new Error(`E08_FIXTURE_CONTRACT_DIGEST_MISMATCH:${repositoryPath}`);
  return source;
}

async function query(database, sql, parameters = []) {
  return (await database.query(sql, parameters)).rows;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
