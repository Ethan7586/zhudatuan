#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const moduleRoot = join(root, 'services/commerce/src/modules');
const files = sources(moduleRoot);
const violations = [];

for (const file of files) {
  const name = relative(root, file);
  const source = readFileSync(file, 'utf8');
  if (/\boffset\s+(?:\$|\d)/i.test(source)) violations.push(`${name}:OFFSET_PAGINATION_FORBIDDEN`);
  if (/\blimit\(request/.test(source)) violations.push(`${name}:LEGACY_LIMIT_WITHOUT_CURSOR`);
  if (/pageResult\(/.test(source) && !name.endsWith('/pricing/PricingOperations.ts')) violations.push(`${name}:PAGE_RESULT_WITHOUT_CURSOR`);
  if (/keysetResult\(/.test(source) && !/queryPage\(/.test(source)) violations.push(`${name}:KEYSET_PAGE_INPUT_MISSING`);
}

for (const [module, method] of [
  ['pricing', 'prices'],
  ['inventory', 'availability'],
]) {
  const source = readFileSync(join(moduleRoot, module, 'public', `${module === 'pricing' ? 'Pricing' : 'Inventory'}ReadPort.ts`), 'utf8');
  if (!new RegExp(`${method}\\(scope: ReadScope, mall: string, skus: readonly string\\[\\]\\)`).test(source) || !/boundedIdentifiers\(skus, 50, 'STOREFRONT_[A-Z]+_SKUS_INVALID'\)/.test(source) || !/any\(\$2::text\[\]\)/i.test(source)) {
    violations.push(`services/commerce/src/modules/${module}/public/${module === 'pricing' ? 'Pricing' : 'Inventory'}ReadPort.ts:BOUNDED_BATCH_PROOF_MISSING`);
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('pagination accepted=true mode=opaque-keyset boundedBatch=pricing violations=0');
}

function sources(directory) {
  const values = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) values.push(...sources(path));
    else if (entry.isFile() && path.endsWith('.ts') && !path.endsWith('.test.ts')) values.push(path);
  }
  return values.sort();
}
