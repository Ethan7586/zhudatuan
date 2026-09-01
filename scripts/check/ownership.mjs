#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

import { productionSources, relative, root } from './source.mjs';

const moduleRoot = path.join(root, 'services/commerce/src/modules');
const contract = parse(fs.readFileSync(path.join(root, 'database/contracts/objects.yml'), 'utf8'));
const sqlReference = /\b((?<!distinct\s)from|join|insert\s+into|update|delete\s+from|truncate(?:\s+table)?|merge\s+into)\s+(?:only\s+)?([a-z][a-z0-9]*)\./gi;

export function schemaOwnership(objects = contract.objects ?? []) {
  const owners = new Map();
  for (const object of objects) {
    if (typeof object?.id !== 'string') continue;
    const schema = object.id.split('.')[0];
    const owner = object.operationalOwner ?? object.owner;
    if (typeof owner !== 'string' || !schema) continue;
    const schemas = owners.get(owner) ?? new Set();
    schemas.add(schema);
    owners.set(owner, schemas);
  }
  return owners;
}

export function auditOwnership(sources = productionSources(), objects = contract.objects ?? []) {
  const schemasByOwner = schemaOwnership(objects);
  const violations = [];
  for (const file of sources) {
    if (!file.startsWith(`${moduleRoot}${path.sep}`)) continue;
    const module = path.relative(moduleRoot, file).split(path.sep)[0];
    const allowed = schemasByOwner.get(module) ?? new Set();
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(sqlReference)) {
      const schema = match[2];
      if (allowed.has(schema)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      violations.push({ file: `${relative(file)}:${line}`, module, schema, operation: match[1].replace(/\s+/g, ' ').toLowerCase() });
    }
  }
  return violations;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const violations = auditOwnership();
  for (const item of violations) console.error(`CROSS_SCHEMA_SQL_FORBIDDEN ${item.file} ${item.module}->${item.schema} ${item.operation}`);
  console.log(`schema-ownership accepted=${violations.length === 0} violations=${violations.length}`);
  process.exitCode = violations.length === 0 ? 0 : 1;
}
