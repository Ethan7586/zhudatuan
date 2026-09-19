import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { serviceEntryDirectory, serviceTargets } from '../adapters/zdt-next/service-targets.mjs';

test('every active business API release entry is assembled through the same Arch board', async () => {
  const apiTargets = Object.entries(serviceTargets).filter(([target]) => target.endsWith('-api'));
  const runtimeEntries = apiTargets.flatMap(([target, entries]) => entries
    .filter((entry) => !entry.endsWith('ReadyMain'))
    .map((entry) => ({ target, entry })));

  assert.deepEqual(apiTargets.map(([target]) => target).sort(), [
    'catalog-api',
    'identity-api',
    'mall-provisioning-api',
    'payment-webhook-api',
    'purchase-api',
    'support-api',
    'web-api',
  ]);
  assert.equal(runtimeEntries.length, 7);

  for (const { target, entry } of runtimeEntries) {
    const source = await readFile(`${serviceEntryDirectory}/${entry}.ts`, 'utf8');
    assert.match(source, /bootstrapApi\s*\(\s*\{/, `${target}:${entry} must use bootstrapApi`);
    assert.match(source, /listen\s*\(/, `${target}:${entry} must expose its assembled app`);
    if (entry === 'WebBusinessApiMain') {
      assert.match(source, /bootstrapped\.arch\.mountAll\(/);
      assert.match(source, /new PublicCatalogHttpHandler\([\s\S]*bootstrapped\.arch/);
    } else {
      assert.match(source, /listen\s*\(\s*bootstrapped\.app/, `${target}:${entry} cannot bypass the assembled app`);
    }
  }
});

test('the API assembly is production fail-closed while health, Jobs and Runner stay parallel', async () => {
  const [httpApp, bootstrap, board, targets] = await Promise.all([
    readFile('01_core_hexin/services/commerce/src/foundation/interface/HttpApp.ts', 'utf8'),
    readFile('01_core_hexin/services/commerce/src/bootstrap/ApiBootstrap.ts', 'utf8'),
    readFile('L-kernel/src/arch/ArchBoard.ts', 'utf8'),
    readFile('04_tools/release-engine/adapters/zdt-next/service-targets.mjs', 'utf8'),
  ]);

  assert.match(httpApp, /NODE_ENV === 'production' && arch === undefined/);
  assert.match(httpApp, /operation\.id\.startsWith\('runtime\.health\.'\)/);
  assert.match(bootstrap, /filter\(\(operation\) => !operation\.startsWith\('runtime\.health\.'\)\)/);
  assert.match(bootstrap, /new HttpApp\([\s\S]*nodeContextResolver, arch\)/);
  const hostedAdapter = await readFile('01_core_hexin/services/commerce/src/bootstrap/ArchOperationAdapter.ts', 'utf8');
  assert.doesNotMatch(hostedAdapter, /ArchBoard \| undefined|arch === undefined/);
  assert.doesNotMatch(board, /member|order|realm|domain|database/i);
  assert.match(targets, /identity-notification-jobs/);
  assert.match(targets, /catalog-jobs/);
  assert.match(targets, /payment-jobs/);
  assert.doesNotMatch(targets, /node-operations.*ArchBoard/s);
});
