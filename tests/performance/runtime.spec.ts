import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { OperationCatalog } from '@shop/contract';
import { ConcurrencyPolicy } from '@shop/providercore';
import { RouteRegistry } from '../../services/commerce/src/bootstrap/RouteRegistry';
import { CAPACITY_MODEL, RUNTIME_LIMITS } from '@shop/config/runtime';
import { RedisCache } from '../../services/commerce/src/foundation/cache/RedisCache';
import { CircuitBreaker } from '../../services/commerce/src/foundation/performance/CircuitBreaker';
import { retryDelay } from '../../services/commerce/src/foundation/performance/Retry';
import { Singleflight } from '../../services/commerce/src/foundation/performance/Singleflight';
import { HttpStream } from '../../services/commerce/src/foundation/interface/HttpStream';
import { AssignmentPolicy } from '../../services/commerce/src/modules/support/domain/policy/AssignmentPolicy';
import { MessagePolicy } from '../../services/commerce/src/modules/support/domain/policy/MessagePolicy';

test('route registry lookup remains below the ordinary query budget', () => {
  const registry = new RouteRegistry();
  for (const operation of OperationCatalog.all()) registry.register({ operation: operation.id, handler: async () => ({ status: 204 }) });
  registry.freeze();
  const samples: number[] = [];
  for (let index = 0; index < 5000; index += 1) {
    const start = performance.now();
    assert.ok(registry.match('GET', '/api/v1/orders'));
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  assert.ok(samples[Math.floor(samples.length * 0.95)]! < 5);
});

test('provider bulkhead never exceeds its signed concurrency limit', async () => {
  const limit = 4;
  const policy = new ConcurrencyPolicy(limit);
  let active = 0;
  let maximum = 0;
  const outcomes = await Promise.allSettled(
    Array.from({ length: 100 }, () =>
      policy.run(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => setImmediate(resolve));
        active -= 1;
      })
    )
  );
  assert.equal(maximum, limit);
  assert.equal(active, 0);
  assert.ok(outcomes.some((outcome) => outcome.status === 'rejected'));
});

test('runtime budgets enforce keyset and database connection ceilings', () => {
  assert.equal(RUNTIME_LIMITS.sql.defaultRows, 50);
  assert.equal(RUNTIME_LIMITS.sql.maximumRows, 200);
  const used = Object.values(RUNTIME_LIMITS.pool).reduce((sum, profile) => sum + profile.maximumConnections, 0);
  assert.ok(used * 100 <= RUNTIME_LIMITS.poolBudget.databaseMaximumConnections * RUNTIME_LIMITS.poolBudget.maximumUtilizationPercent);
  assert.ok(RUNTIME_LIMITS.poolBudget.maximumUtilizationPercent <= 70);
});

test('in-process admission exceeds 5000 query, 300 order and 600 webhook operations per second', () => {
  assert.deepEqual({ query: CAPACITY_MODEL.peakApiQps, order: CAPACITY_MODEL.peakOrderTps, webhook: CAPACITY_MODEL.peakPaymentCallbackTps }, { query: 5000, order: 300, webhook: 600 });
  const registry = new RouteRegistry();
  for (const operation of OperationCatalog.all()) registry.register({ operation: operation.id, handler: async () => ({ status: 204 }) });
  registry.freeze();
  measure(CAPACITY_MODEL.peakApiQps, () => registry.match('GET', '/api/v1/orders'));
  measure(CAPACITY_MODEL.peakOrderTps, () => registry.match('POST', '/api/v1/orders'));
  measure(CAPACITY_MODEL.peakPaymentCallbackTps, () => registry.match('POST', '/api/v1/webhooks/wechat/payment'));
});

test('cache stampede shares one load and complete Redis loss degrades to authoritative reads', async () => {
  const flights = new Singleflight();
  let loads = 0;
  const values = await Promise.all(
    Array.from({ length: 500 }, () =>
      flights.run('catalog:mall:one', async () => {
        loads += 1;
        await new Promise<void>((resolve) => setImmediate(resolve));
        return 'authoritative';
      })
    )
  );
  assert.equal(loads, 1);
  assert.ok(values.every((value) => value === 'authoritative'));

  const cache = new RedisCache(async () => {
    throw new Error('REDIS_UNAVAILABLE');
  });
  await cache.start();
  assert.equal(cache.state().available, false);
  assert.equal(await cache.get('catalog:one'), null);
  assert.equal(await cache.put('catalog:one', { version: 1 }, 30), false);
  await cache.close();
});

test('provider timeout opens the circuit and retry backoff remains jittered and bounded', async () => {
  let now = 0;
  let calls = 0;
  const circuit = new CircuitBreaker(2, 100, () => now);
  const fail = async () => {
    calls += 1;
    throw new Error('PROVIDER_TIMEOUT');
  };
  await assert.rejects(circuit.run(fail), /PROVIDER_TIMEOUT/);
  await assert.rejects(circuit.run(fail), /PROVIDER_TIMEOUT/);
  assert.equal(circuit.snapshot(), 'open');
  await assert.rejects(circuit.run(fail), /CIRCUIT_OPEN/);
  assert.equal(calls, 2);
  now = 101;
  await assert.doesNotReject(circuit.run(async () => 'healthy'));
  assert.equal(circuit.snapshot(), 'closed');
  assert.equal(
    retryDelay(3, 250, 60_000, () => 0),
    0
  );
  assert.ok(retryDelay(8, 250, 60_000, () => 0.999) <= 32_000);
});

test('support message, queue and realtime SLOs are declared at their release thresholds', () => {
  const telemetry = readFileSync('config/telemetry.yml', 'utf8');
  assert.match(telemetry, /supportMessageSendP95Ms: 300/);
  assert.match(telemetry, /supportConversationP95Ms: 500/);
  assert.match(telemetry, /supportQueueP95Ms: 500/);
  assert.match(telemetry, /supportEventDeliveryP95Ms: 1000/);
  assert.equal(RUNTIME_LIMITS.stream.maximumConnections, 2000);
  assert.equal(RUNTIME_LIMITS.stream.maximumConnectionsPerScope, 100);
});

test('local support hot paths retain ample headroom below their production p95 budgets', async () => {
  const messages = new MessagePolicy();
  const assignments = new AssignmentPolicy();
  const agents = Array.from({ length: 100 }, (_, index) => ({ id: `agent:${index}`, online: true, state: 'available' as const, load: index % 5, capacity: 10, skills: ['general'], scopes: ['mall:one'], lastAssignedAt: null }));
  const messageSamples: number[] = [];
  const queueSamples: number[] = [];
  const eventSamples: number[] = [];
  for (let index = 0; index < 500; index += 1) {
    sample(messageSamples, () => messages.prepare({ body: '客服已收到你的问题', clientMessageId: `client:${String(index).padStart(8, '0')}`, attachmentIds: [] }));
    sample(queueSamples, () => assignments.decide({ agents, scope: 'mall:one', skill: 'general', priority: 'normal' }));
    const started = performance.now();
    const stream = new HttpStream((async function* () { yield { id: `${index}-0`, event: 'support.message.sent', data: { ticketId: 'ticket:one', conversationId: 'conversation:one', sequence: index + 1 } }; })());
    const reader = stream.readable(new AbortController().signal).getReader();
    const frame = await reader.read();
    assert.equal(frame.done, false);
    eventSamples.push(performance.now() - started);
    await reader.cancel();
  }
  assert.ok(percentile(messageSamples, 0.95) < 300);
  assert.ok(percentile(queueSamples, 0.95) < 500);
  assert.ok(percentile(eventSamples, 0.95) < 1000);
});

function measure(count: number, operation: () => unknown): void {
  const started = performance.now();
  for (let index = 0; index < count; index += 1) assert.ok(operation());
  const seconds = Math.max((performance.now() - started) / 1000, 0.001);
  assert.ok(count / seconds >= count, `admission throughput ${Math.floor(count / seconds)} is below ${count}`);
}

function sample(values: number[], operation: () => unknown): void {
  const started = performance.now();
  assert.ok(operation());
  values.push(performance.now() - started);
}

function percentile(values: number[], ratio: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))]!;
}
