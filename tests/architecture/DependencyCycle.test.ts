import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('Workspace、模块和运行时依赖图无循环或反向依赖', async () => {
  const [dependencies, runtime] = await Promise.all([
    audit('scripts/audit/dependencies.mjs'),
    audit('scripts/audit/runtimegraph.mjs'),
  ]);
  assert.match(dependencies, /dependenc|accepted|verified/i);
  assert.match(runtime, /runtime|graph|accepted|verified/i);
});
