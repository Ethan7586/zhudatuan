import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('two build slots are isolated and share one bounded host budget', async () => {
  const [install, policy, fleet, smoke] = await Promise.all([
    source('02_platform_pingtai/infrastructure/github-actions-runner/install-build-slot-2.sh'),
    source('02_platform_pingtai/infrastructure/github-actions-runner/install-build-capacity-policy.sh'),
    source('02_platform_pingtai/infrastructure/github-actions-runner/runner-fleet-status.sh'),
    source('.github/workflows/runner-slots-smoke.yml'),
  ]);
  assert.match(install, /RUNNER_USER='zdt-build-2'/);
  assert.match(install, /RUNNER_ROOT='\/opt\/actions-runner-build-2'/);
  assert.match(install, /--labels 'zdt-aliyun-build,zdt-aliyun-build-2'/);
  assert.match(install, /installed offline; apply the shared capacity policy before activation/);
  assert.doesNotMatch(install, /enable --now "\$service_name"/);
  assert.match(policy, /CPUQuota=350%/);
  assert.match(policy, /MemoryMax=6800M/);
  assert.match(policy, /\/run\/lock\/zdt-build/);
  assert.match(policy, /SupplementaryGroups=zdt-builders/);
  assert.match(policy, /systemctl kill --kill-who=all --signal=SIGTERM/);
  assert.doesNotMatch(policy, /systemctl restart/);
  assert.match(fleet, /aliyun-staging-zdt-build-2/);
  assert.match(smoke, /zdt-aliyun-build-1/);
  assert.match(smoke, /zdt-aliyun-build-2/);
  assert.equal((smoke.match(/test -w \/run\/lock\/zdt-build/g) ?? []).length, 2);
  assert.doesNotMatch(smoke, /secrets\./);
});
