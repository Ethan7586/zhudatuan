import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import './runtime.spec';

test('Checkout 报价和确认预算由遥测单一事实源锁定', async () => {
  const telemetry = parse(await readFile('config/telemetry.yml', 'utf8'));
  assert.equal(telemetry.slo.checkoutQuoteP95Ms, 800);
  assert.equal(telemetry.slo.checkoutConfirmP95Ms, 1000);
  const source = await readFile('services/commerce/src/modules/checkout/application/service/QuoteReader.ts', 'utf8');
  assert.match(source, /allParallel\(/);
  assert.match(source, /parallelConcurrency/);
  assert.match(source, /expiresAt: control\.expiresAt, signal: control\.signal/);
});
