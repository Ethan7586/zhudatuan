import assert from 'node:assert/strict';
import test from 'node:test';

import { exactPlacements, orderedExactPlacements, runExactBatch } from '../src/exact-batch.mjs';

const adapter = {
  targets: {
    'database-migration': { after: [] },
    'identity-api': { after: ['database-migration'] },
  },
};

test('explicit placements keep their nodes while the existing target order puts migration first', () => {
  const placements = exactPlacements('identity-api,database-migration', 'hbbtzn-l1,zhudatuan-l0');
  assert.deepEqual(orderedExactPlacements(adapter, placements), [
    { target: 'database-migration', node: 'zhudatuan-l0' },
    { target: 'identity-api', node: 'hbbtzn-l1' },
  ]);
  assert.deepEqual(exactPlacements('identity-api,identity-api', 'hbbtzn-l1,hbbtzn-l1'), [{ target: 'identity-api', node: 'hbbtzn-l1' }]);
  assert.throws(() => exactPlacements('identity-api,database-migration', 'hbbtzn-l1'), /Every exact target needs one physical node/);
});

test('cold exact batch prepares both missing artifacts once and deploys migration before service', async () => {
  const events = [];
  const result = await runExactBatch(adapter, exactPlacements('identity-api,database-migration', 'hbbtzn-l1,zhudatuan-l0'), {
    inspect: async (target) => { events.push(`lookup:${target}`); return { exists: false }; },
    prepare: async (targets) => { events.push(`prepare:${targets.join(',')}`); return { dependenciesMs: 11 }; },
    sync: async () => { events.push('sync'); return 'agent'; },
    deploy: async ({ target, node }, agent) => { events.push(`deploy:${target}:${node}:${agent}`); return { target, node, current: 'source', health: { status: target === 'identity-api' ? 'ready' : 'not-checked' } }; },
  });
  assert.deepEqual(events, [
    'lookup:database-migration', 'lookup:identity-api',
    'prepare:database-migration,identity-api', 'sync',
    'deploy:database-migration:zhudatuan-l0:agent', 'deploy:identity-api:hbbtzn-l1:agent',
  ]);
  assert.equal(result.cacheStatus, 'built');
  assert.equal(result.deployments.length, 2);
});

test('warm and partial cache batches skip or limit preparation without changing deployment order', async () => {
  for (const missing of [[], ['identity-api']]) {
    const prepared = [];
    const deployed = [];
    const result = await runExactBatch(adapter, exactPlacements('identity-api,database-migration', 'hbbtzn-l1,zhudatuan-l0'), {
      inspect: async (target) => ({ exists: !missing.includes(target) }),
      prepare: async (targets) => { prepared.push(targets); return { rebuilt: targets }; },
      sync: async () => 'agent',
      deploy: async ({ target }) => { deployed.push(target); return { target }; },
    });
    assert.deepEqual(prepared, missing.length ? [missing] : []);
    assert.deepEqual(deployed, ['database-migration', 'identity-api']);
    assert.equal(result.cacheStatus, missing.length ? 'built' : 'reused');
  }
});

test('a failed migration stops the service, while a failed service does not hide the completed migration', async () => {
  const placements = exactPlacements('identity-api,database-migration', 'hbbtzn-l1,zhudatuan-l0');
  for (const failedTarget of ['database-migration', 'identity-api']) {
    const completed = [];
    await assert.rejects(runExactBatch(adapter, placements, {
      inspect: async () => ({ exists: true }),
      prepare: async () => { throw new Error('warm batch should not build'); },
      sync: async () => 'agent',
      deploy: async ({ target }) => {
        if (target === failedTarget) throw new Error(`${target} failed`);
        completed.push(target);
        return { target };
      },
    }), new RegExp(`${failedTarget} failed`));
    assert.deepEqual(completed, failedTarget === 'database-migration' ? [] : ['database-migration']);
  }
});
