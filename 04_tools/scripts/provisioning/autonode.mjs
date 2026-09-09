// Candidate-only CLI:
//   node --import tsx 04_tools/scripts/provisioning/autonode.mjs provision --root <absolute-dir> --request <request.json>
//   node --import tsx 04_tools/scripts/provisioning/autonode.mjs rollback --root <absolute-dir> --request <request.json> --reason <text>

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { FileNodeProvisioningEngine } from './autonode-engine.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: 'string' },
    request: { type: 'string' },
    reason: { type: 'string' },
  },
  strict: true,
});

const command = positionals[0];
if ((command !== 'provision' && command !== 'rollback') || !values.root || !values.request) {
  throw new Error('AUTONODE_USAGE_INVALID');
}

const request = JSON.parse(await readFile(values.request, 'utf8'));
const engine = new FileNodeProvisioningEngine(values.root);
if (command === 'provision') {
  const result = await engine.provision(request);
  process.stdout.write(`${JSON.stringify({
    provisioning_request_id: result.ledger.provisioning_request_id,
    state: result.ledger.state,
    node_id: result.manifest.node_id,
    manifest_digest: result.manifest.manifest_digest,
    candidate_bundle_digest: result.receipt.candidate_bundle_digest,
    production_status: result.receipt.production_status,
    candidate_directory: result.nodeDirectory,
  }, null, 2)}\n`);
} else {
  const receipt = await engine.rollback(request, values.reason ?? 'candidate rollback');
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
