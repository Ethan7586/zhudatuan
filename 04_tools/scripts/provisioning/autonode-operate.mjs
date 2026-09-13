import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import {
  NodeOperationsEngine,
  parseNodeOperationRequest,
} from './autonode-operations-engine.mjs';
import { ProductionNodeOperationsProvider } from './autonode-operations-provider.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'state-root': { type: 'string' },
    request: { type: 'string' },
  },
  strict: true,
});

const command = positionals[0]?.toUpperCase();
if (!['STATUS', 'PAUSE', 'RESUME', 'UPGRADE', 'ROLLBACK', 'LOGS', 'RECEIPT'].includes(command)
  || !values['state-root'] || !values.request) {
  throw new Error('AUTONODE_OPERATION_USAGE_INVALID');
}

const request = parseNodeOperationRequest(JSON.parse(await readFile(values.request, 'utf8')));
if (command !== 'RECEIPT' && command !== request.action.type) {
  throw new Error(`AUTONODE_OPERATION_COMMAND_MISMATCH:${command}:${request.action.type}`);
}
const engine = new NodeOperationsEngine(values['state-root'], new ProductionNodeOperationsProvider());
const receipt = command === 'RECEIPT' ? await engine.read(request) : await engine.execute(request);
process.stdout.write(`${JSON.stringify(summary(receipt), null, 2)}\n`);

function summary(value) {
  if (value === null) return null;
  return {
    operation_request_id: value.operation_request_id,
    node_id: value.node_id,
    action: value.action,
    status: value.status,
    attempt: value.attempt,
    replayed: value.replayed,
    completed_at: value.completed_at,
    result: value.result,
    error: value.error,
  };
}
