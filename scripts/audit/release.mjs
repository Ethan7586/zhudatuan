import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const source = parse(readFileSync(resolve(root, 'config/requirements.yml'), 'utf8'));
const blockers = (source.clarifications ?? []).filter(({ status }) => status === 'open');
if (process.env.SHOP_RELEASE_MODE === 'production' && blockers.length > 0) {
  for (const blocker of blockers) process.stderr.write(`release blocker ${blocker.id}: ${blocker.term} (${blocker.owner})\n`);
  process.exit(1);
}
if (blockers.some(({ id, owner, acceptance, resolvedby }) => !id || !owner || acceptance !== null || resolvedby !== null)) {
  throw new Error('RELEASE_BLOCKER_SOURCE_INVALID');
}
process.stdout.write(`release blockers: ${blockers.length} open\n`);
