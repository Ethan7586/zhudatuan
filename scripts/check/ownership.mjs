#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { productionSources, relative, root } from './source.mjs';

const moduleRoot = path.join(root, 'services/commerce/src/modules');
const sharedInfrastructure = new Set(['audit', 'runtime']);
const schemaOwners = new Map([
  ['finance', new Set(['finance', 'invoice'])],
  ['order', new Set(['ordering'])],
]);
const sqlReference = /\b((?<!distinct\s)from|join|insert\s+into|update|delete\s+from|truncate(?:\s+table)?|merge\s+into)\s+(?:only\s+)?([a-z][a-z0-9]*)\./gi;
const violations = [];

for (const file of productionSources()) {
  if (!file.startsWith(`${moduleRoot}${path.sep}`)) continue;
  const module = path.relative(moduleRoot, file).split(path.sep)[0];
  const owners = schemaOwners.get(module) ?? new Set([module]);
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(sqlReference)) {
    const schema = match[2];
    if (owners.has(schema) || sharedInfrastructure.has(schema)) continue;
    const line = source.slice(0, match.index).split('\n').length;
    violations.push({ file: `${relative(file)}:${line}`, module, schema, operation: match[1].replace(/\s+/g, ' ').toLowerCase() });
  }
}

for (const item of violations) console.error(`SCHEMA_OWNER_VIOLATION ${item.file} ${item.module}->${item.schema} ${item.operation}`);
console.log(`schema-ownership accepted=${violations.length === 0} violations=${violations.length}`);
process.exitCode = violations.length === 0 ? 0 : 1;
