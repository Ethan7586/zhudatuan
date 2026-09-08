#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const sourcePath = join(repositoryRoot, 'config/changeplan.yml');
const outputPath = join(repositoryRoot, 'docs/evidence/changeplan.json');
const plan = parse(readFileSync(sourcePath, 'utf8'));
const packageDocument = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
const packages = plan.packages ?? [];
validate();
const topology = layers(packages);
const output = `${JSON.stringify(
  {
    schema: 'zhudatuan.change-plan.v1',
    generated: true,
    count: packages.length,
    checkOrder: plan.checkOrder,
    topology,
    packages,
    parallelGroups: plan.parallelGroups,
    internalParallel: plan.internalParallel,
    coordination: plan.coordination,
    conflicts: plan.conflicts,
  },
  null,
  2
)}\n`;
if (process.argv.includes('--check')) {
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== output) throw new Error('CHANGE_PLAN_EVIDENCE_DRIFT');
} else {
  writeFileSync(outputPath, output, 'utf8');
}
process.stdout.write(`change plan accepted: packages=${packages.length} layers=${topology.length} conflicts=${Object.keys(plan.conflicts).length}\n`);

function validate() {
  if (plan.version !== 1 || plan.owner !== 'architecture' || plan.count !== 24 || packages.length !== 24) throw new Error('CHANGE_PLAN_HEADER_INVALID');
  const ids = packages.map(({ id }) => id);
  const expected = Array.from({ length: 24 }, (_, index) => `P${String(index).padStart(2, '0')}`);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error('CHANGE_PLAN_SEQUENCE_INVALID');
  if (JSON.stringify(plan.checkOrder) !== JSON.stringify(['authority', 'generate', 'domain', 'tests', 'client', 'quality', 'operations', 'evidence'])) throw new Error('CHANGE_PLAN_CHECK_ORDER_INVALID');
  const byId = new Map(packages.map((item) => [item.id, item]));
  for (const item of packages) {
    if (!item.name || !Array.isArray(item.paths) || item.paths.length === 0 || !Array.isArray(item.checks) || item.checks.length === 0) throw new Error('CHANGE_PLAN_PACKAGE_INVALID:' + item.id);
    if (new Set(item.dependencies).size !== item.dependencies.length || item.dependencies.some((id) => !byId.has(id) || id >= item.id)) throw new Error('CHANGE_PLAN_DEPENDENCY_INVALID:' + item.id);
    for (const path of item.paths) if (!existsSync(join(repositoryRoot, path))) throw new Error('CHANGE_PLAN_PATH_MISSING:' + item.id + ':' + path);
    for (const check of item.checks) if (typeof packageDocument.scripts?.[check] !== 'string') throw new Error('CHANGE_PLAN_CHECK_UNKNOWN:' + item.id + ':' + check);
  }
  if (packages.at(-1).dependencies.length !== 23) throw new Error('CHANGE_PLAN_RELEASE_DEPENDENCY_INVALID');
  for (const [name, conflict] of Object.entries(plan.conflicts ?? {})) {
    if (!byId.has(conflict.owner) || !Array.isArray(conflict.paths) || conflict.paths.length === 0) throw new Error('CHANGE_PLAN_CONFLICT_INVALID:' + name);
    for (const path of conflict.paths) if (!existsSync(join(repositoryRoot, path))) throw new Error('CHANGE_PLAN_CONFLICT_PATH_MISSING:' + name + ':' + path);
  }
  for (const group of plan.parallelGroups ?? []) {
    if (new Set(group).size !== group.length || group.some((id) => !byId.has(id))) throw new Error('CHANGE_PLAN_PARALLEL_GROUP_INVALID');
    for (const left of group) for (const right of group) if (left !== right && dependsOn(byId, left, right)) throw new Error('CHANGE_PLAN_PARALLEL_DEPENDENCY_INVALID:' + left + ':' + right);
  }
  validateInternalParallel(byId);
}

function validateInternalParallel(byId) {
  const expected = ['P08', 'P10', 'P13', 'P16'];
  if (JSON.stringify(Object.keys(plan.internalParallel ?? {})) !== JSON.stringify(expected)) throw new Error('CHANGE_PLAN_INTERNAL_PARALLEL_INVALID');
  for (const id of expected) {
    const value = plan.internalParallel[id];
    if (!byId.has(id) || !Array.isArray(value.lanes) || value.lanes.length < 3 || value.lanes.some((lane) => !Array.isArray(lane) || lane.length === 0)) {
      throw new Error('CHANGE_PLAN_INTERNAL_LANES_INVALID:' + id);
    }
  }
  const coordination = plan.coordination ?? {};
  if (
    coordination.designExportOwner !== 'P04' ||
    coordination.compositionOwner !== 'P06' ||
    coordination.runtimeRegistryOwner !== 'P06' ||
    coordination.migrationOwner !== 'P07' ||
    coordination.migrationCollaboration !== 'schema-proposal'
  ) {
    throw new Error('CHANGE_PLAN_COORDINATION_INVALID');
  }
  if (JSON.stringify(coordination.clientWave?.packages) !== JSON.stringify(['P19', 'P20', 'P21', 'P22']) || JSON.stringify(coordination.clientWave?.orderingExceptions) !== JSON.stringify(['P20-after-P19'])) {
    throw new Error('CHANGE_PLAN_CLIENT_WAVE_INVALID');
  }
}

function layers(values) {
  const pending = new Map(values.map((item) => [item.id, item]));
  const complete = new Set();
  const result = [];
  while (pending.size > 0) {
    const ready = [...pending.values()].filter(({ dependencies }) => dependencies.every((id) => complete.has(id))).map(({ id }) => id);
    if (ready.length === 0) throw new Error('CHANGE_PLAN_CYCLE');
    result.push(ready);
    for (const id of ready) {
      pending.delete(id);
      complete.add(id);
    }
  }
  return result;
}

function dependsOn(byId, source, target, seen = new Set()) {
  if (seen.has(source)) return false;
  seen.add(source);
  const dependencies = byId.get(source).dependencies;
  return dependencies.includes(target) || dependencies.some((id) => dependsOn(byId, id, target, new Set(seen)));
}
