#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const sourcePath = join(repositoryRoot, 'config/retirement.yml');
const outputPath = join(repositoryRoot, 'docs/evidence/retirement.json');
const policy = parse(readFileSync(sourcePath, 'utf8'));
const violations = [];

for (const path of policy.removed) if (existsSync(join(repositoryRoot, path))) violations.push({ code: 'RETIRED_PATH_PRESENT', path });
for (const path of policy.required) if (!existsSync(join(repositoryRoot, path))) violations.push({ code: 'REPLACEMENT_PATH_MISSING', path });

const productionFiles = policy.activeRoots.flatMap((path) => files(join(repositoryRoot, path))).filter(sourceFile);
const forbiddenNames = new Set(policy.forbiddenProductionNames);
for (const file of productionFiles) {
  const path = relative(repositoryRoot, file);
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (forbiddenNames.has(name)) violations.push({ code: 'RETIRED_PRODUCTION_FILE_PRESENT', path });
}

const referenceFiles = [...productionFiles, ...policy.activeContracts.flatMap((path) => files(join(repositoryRoot, path))).filter(textFile)];
for (const file of new Set(referenceFiles)) {
  const source = readFileSync(file, 'utf8');
  for (const token of policy.forbiddenReferences) if (source.includes(token)) violations.push({ code: 'RETIRED_REFERENCE_PRESENT', path: relative(repositoryRoot, file), token });
}

const archive = parse(readFileSync(join(repositoryRoot, policy.archive.catalog), 'utf8'));
const archiveFiles = archive.batches.flatMap(({ path }) => files(join(repositoryRoot, path)));
if (archive.status !== 'superseded' || archiveFiles.length !== policy.archive.count || archive.batches.some(({ path, count }) => files(join(repositoryRoot, path)).length !== count)) {
  violations.push({ code: 'ARCHIVE_CATALOG_INVALID', path: policy.archive.catalog });
}

const locks = files(repositoryRoot).filter((path) => ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].includes(path.slice(path.lastIndexOf('/') + 1)) && !path.includes('/node_modules/'));
if (locks.length !== 1 || relative(repositoryRoot, locks[0]) !== 'package-lock.json') violations.push({ code: 'LOCK_AUTHORITY_INVALID', paths: locks.map((path) => relative(repositoryRoot, path)) });

const evidence = {
  schema: 'zhudatuan.retirement.v1',
  generated: true,
  accepted: violations.length === 0,
  removed: policy.removed.length,
  replacements: policy.required.length,
  productionFiles: productionFiles.length,
  references: referenceFiles.length,
  archiveFiles: archiveFiles.length,
  lock: locks.length === 1 ? relative(repositoryRoot, locks[0]) : null,
  violations,
};
const output = `${JSON.stringify(evidence, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== output) throw new Error('RETIREMENT_EVIDENCE_DRIFT');
} else writeFileSync(outputPath, output, 'utf8');
if (violations.length > 0) {
  process.stderr.write(`${JSON.stringify(violations, null, 2)}\n`);
  process.exitCode = 1;
} else process.stdout.write(`retirement accepted: removed=${policy.removed.length} replacements=${policy.required.length} archive=${archiveFiles.length}\n`);

function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' ? [] : files(join(path, entry.name))));
}

function sourceFile(path) {
  return ['.ts', '.tsx', '.js', '.mjs', '.css', '.json', '.yml', '.yaml'].includes(extname(path)) && !path.includes('/test/') && !/\.(?:test|spec)\.[^.]+$/.test(path);
}

function textFile(path) {
  return ['.ts', '.tsx', '.js', '.mjs', '.css', '.json', '.yml', '.yaml', '.sql'].includes(extname(path));
}
