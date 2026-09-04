import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { OperationCatalog } from '@shop/contract';
import { ConcurrencyPolicy } from '@shop/vendorcore';
import { RouteRegistry } from '../../../01_core_hexin/services/commerce/src/bootstrap/RouteRegistry';

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
  const outcomes = await Promise.allSettled(Array.from({ length: 100 }, () => policy.run(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise<void>((resolve) => setImmediate(resolve));
    active -= 1;
  })));
  assert.equal(maximum, limit);
  assert.equal(active, 0);
  assert.ok(outcomes.some((outcome) => outcome.status === 'rejected'));
});
