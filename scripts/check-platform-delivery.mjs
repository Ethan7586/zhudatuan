import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from './lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const authority = parse(readFileSync(resolve(root, 'config/requirements.yml'), 'utf8'));
const matrix = parse(readFileSync(resolve(root, 'docs/requirements/mvp.yml'), 'utf8'));
const delivery = parse(readFileSync(resolve(root, 'infrastructure/cloud/Delivery.yml'), 'utf8'));
const expected = (authority?.mvp ?? []).map(({ id }) => id);
const requirements = matrix?.requirements ?? [];

if (expected.length !== 22 || matrix?.count !== expected.length || requirements.length !== expected.length) throw new Error('MVP_DELIVERY_COUNT_INVALID');
if (requirements.map(({ id }) => id).join(',') !== expected.join(',')) throw new Error('MVP_DELIVERY_ID_DRIFT');
for (const requirement of requirements) {
  if (!Array.isArray(requirement.routes) || requirement.routes.length === 0 || requirement.routes.some((route) => !/^\/[^\s]*$/.test(route))) throw new Error(`MVP_ROUTES_INVALID:${requirement.id}`);
  if (!Array.isArray(requirement.operations) || requirement.operations.length === 0) throw new Error(`MVP_OPERATION_MISSING:${requirement.id}`);
  if (!Array.isArray(requirement.modules) || requirement.modules.length === 0) throw new Error(`MVP_MODULE_MISSING:${requirement.id}`);
  if (!Array.isArray(requirement.tables) || requirement.tables.length === 0) throw new Error(`MVP_TABLE_MISSING:${requirement.id}`);
  for (const field of ['contractTest', 'journeyTest', 'dashboard', 'runbook']) {
    const evidence = requirement[field];
    if (typeof evidence !== 'string' || !existsSync(resolve(root, evidence))) throw new Error(`MVP_EVIDENCE_MISSING:${requirement.id}:${field}`);
  }
  if (!['Designed', 'Implemented', 'Integrated', 'Accepted', 'Released'].includes(requirement.status)) throw new Error(`MVP_STATUS_INVALID:${requirement.id}`);
}
if (JSON.stringify([...(delivery?.release?.clients ?? [])].sort()) !== JSON.stringify(['auth', 'console', 'storefront'])) throw new Error('CLIENT_DELIVERY_SET_INVALID');
console.log(`platform delivery: ${expected.length} MVP requirements and three canonical client artifacts are traceable`);
