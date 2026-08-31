import { constants } from 'node:fs';
import { access, lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { verifyLiveCandidate } from './readiness-candidate.mjs';
import { verifyLiveCloudHost } from './readiness-cloud-host.mjs';
import { FULL_ROOT, valueAt } from './readiness-common.mjs';
import { argumentsFrom, fail, gates, validateEvidence, verifyGate } from './readiness-contract.mjs';
import { verifyLiveDatabaseRetirement } from './readiness-database.mjs';
import { verifyLiveFullJobs } from './readiness-full-jobs.mjs';
import { verifyLiveHostConfiguration } from './readiness-host.mjs';
import { verifyLiveRuntime } from './readiness-runtime.mjs';
import { verifyLiveHostToolchain } from './readiness-toolchain.mjs';

const options = argumentsFrom(process.argv.slice(2));
const evidencePath = resolve(options.evidence);
const examplePaths = new Set([
  resolve(import.meta.dirname, 'readiness.evidence.example.yml'),
  `${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/readiness.evidence.example.yml`,
]);
const liveEvidencePath = `${FULL_ROOT}/shared/evidence/readiness.yml`;
const example = examplePaths.has(evidencePath);
if (!example && evidencePath !== liveEvidencePath) fail('EVIDENCE_PATH_INVALID');
const information = await lstat(evidencePath);
if (!information.isFile() || information.isSymbolicLink()) fail('EVIDENCE_FILE_INVALID');
if (!example) {
  if (information.uid !== 0 || information.gid !== 0 || (information.mode & 0o777) !== 0o600) fail('EVIDENCE_FILE_MODE_INVALID');
  for (const directory of [`${FULL_ROOT}/shared`, `${FULL_ROOT}/shared/evidence`]) {
    const boundary = await lstat(directory);
    if (!boundary.isDirectory() || boundary.isSymbolicLink() || boundary.uid !== 0 || boundary.gid !== 0
      || (boundary.mode & 0o777) !== 0o700) fail('EVIDENCE_DIRECTORY_BOUNDARY_INVALID');
  }
}
await access(evidencePath, constants.R_OK);
const evidence = parseYaml(await readFile(evidencePath, 'utf8'));
validateEvidence(evidence);

const selected = options.all ? Object.keys(gates) : [options.check];
const liveMissing = new Map();
const observed = new Map();
if (example) for (const gate of selected) liveMissing.set(gate, ['example:validation-only']);
if (!example && selected.includes('P01')) liveMissing.set('P01', await verifyLiveCandidate(evidence, observed));
if (!example && selected.includes('P07') && valueAt(evidence, 'checks.P09') !== 'verified') {
  liveMissing.set('P07', [
    ...await verifyLiveHostConfiguration(evidence, 'bootstrap', observed),
    ...await verifyLiveHostToolchain(evidence, observed),
  ]);
}
if (!example && selected.includes('P09')) liveMissing.set('P09', [
  ...await verifyLiveHostConfiguration(evidence, 'runtime', observed),
  ...await verifyLiveDatabaseRetirement(evidence, observed),
]);
if (!example && selected.includes('P10')) liveMissing.set('P10', await verifyLiveRuntime(evidence, observed));
if (!example && selected.includes('P12')) liveMissing.set('P12', await verifyLiveFullJobs(evidence, observed));
const cloudGate = selected.find((gate) => Object.keys(gates).indexOf(gate) >= Object.keys(gates).indexOf('P05'));
if (!example && cloudGate !== undefined) {
  liveMissing.set(cloudGate, [
    ...(liveMissing.get(cloudGate) ?? []),
    ...await verifyLiveCloudHost(evidence, observed),
  ]);
}

const results = selected.map((gate) => verifyGate(evidence, gate, liveMissing.get(gate) ?? []));
const readinessSatisfied = results.every(({ missing }) => missing.length === 0);
if (options.json) {
  process.stdout.write(`${JSON.stringify({ profile: 'full', readinessSatisfied, results,
    ...(options.collectLive ? { observed: Object.fromEntries([...observed].sort(([left], [right]) => left.localeCompare(right))) } : {}) })}\n`);
} else {
  for (const result of results) {
    process.stdout.write(`${result.gate} ${result.status}${result.missing.length ? ` missing=${result.missing.join(',')}` : ''}\n`);
  }
}
if (!readinessSatisfied) process.exitCode = 1;
