import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from './lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const matrix = parse(readFileSync(resolve(root, 'docs/requirements/mvp.yml'), 'utf8'));
const delivery = readFileSync(resolve(root, 'infrastructure/aliyun/delivery.yml'), 'utf8');
const expected = Array.from({ length: 21 }, (_, index) => `MVP${String(index + 3).padStart(2, '0')}`);
const requirements = matrix?.requirements ?? [];

if (matrix?.count !== 21 || requirements.length !== 21) throw new Error('MVP_DELIVERY_COUNT_INVALID');
if (requirements.map(({ id }) => id).join(',') !== expected.join(',')) throw new Error('MVP_DELIVERY_ID_DRIFT');
for (const requirement of requirements) {
  if (!/^\/[^\s]*$/.test(requirement.route ?? '')) throw new Error(`MVP_ROUTE_INVALID:${requirement.id}`);
  if (!Array.isArray(requirement.operations) || requirement.operations.length === 0) throw new Error(`MVP_OPERATION_MISSING:${requirement.id}`);
  if (!Array.isArray(requirement.modules) || requirement.modules.length === 0) throw new Error(`MVP_MODULE_MISSING:${requirement.id}`);
  if (!Array.isArray(requirement.tables) || requirement.tables.length === 0) throw new Error(`MVP_TABLE_MISSING:${requirement.id}`);
  for (const field of ['contractTest', 'journeyTest', 'dashboard', 'runbook']) {
    const evidence = requirement[field];
    if (typeof evidence !== 'string' || !existsSync(resolve(root, evidence))) throw new Error(`MVP_EVIDENCE_MISSING:${requirement.id}:${field}`);
  }
  if (!['Implemented', 'Integrated', 'Accepted', 'Released'].includes(requirement.status)) throw new Error(`MVP_STATUS_INVALID:${requirement.id}`);
}
for (const client of ['console', 'store', 'supplier', 'storefront', 'auth', 'miniapp']) if (!delivery.includes(`artifact: ${client}`)) throw new Error(`CLIENT_DELIVERY_MISSING:${client}`);
console.log('platform delivery: 21 MVP requirements and six canonical client artifacts are traceable');
