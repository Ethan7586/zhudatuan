// Explicit Sovereign-upgrade planning CLI. Hosted registration and mall opening have no AutoNode entrypoint.
//   node --import tsx 04_tools/scripts/provisioning/autonode.mjs plan-sovereign-upgrade --request <request-and-upgrade.json>

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { sovereignUpgradeAutoNodePlan } from './autonode-sovereign-upgrade.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    request: { type: 'string' },
  },
  strict: true,
});

const command = positionals[0];
if (command !== 'plan-sovereign-upgrade' || !values.request) {
  throw new Error('AUTONODE_USAGE_INVALID');
}

const request = JSON.parse(await readFile(values.request, 'utf8'));
process.stdout.write(`${JSON.stringify(sovereignUpgradeAutoNodePlan(request), null, 2)}\n`);
