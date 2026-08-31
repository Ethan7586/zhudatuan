import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const manifestPath = join(repositoryRoot, 'config', 'artifacts.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.schema !== 'zhudatuan.artifacts.v3') throw new Error('ARTIFACT_MANIFEST_SCHEMA_INVALID');
if (!manifest.eligibility?.derived || typeof manifest.eligibility.source !== 'string') {
  throw new Error('ARTIFACT_ELIGIBILITY_MUST_BE_DERIVED');
}

assertExact('APPLICATION', [...manifest.applications].sort(), workspaceDirectories('apps'));
assertExact('SERVICE', [manifest.service], workspaceDirectories('services'));

const selected = [...manifest.applications, manifest.service, manifest.database, ...manifest.extensions, manifest.eligibility.source];
for (const path of selected) {
  if (!existsSync(join(repositoryRoot, path))) throw new Error(`SELECTED_ARTIFACT_MISSING:${path}`);
}

const authorities = new Set(manifest.authorities ?? []);
const generated = new Set(manifest.generated ?? []);
if (authorities.size !== manifest.authorities?.length) throw new Error('ARTIFACT_AUTHORITY_DUPLICATE');
if (generated.size !== manifest.generated?.length) throw new Error('ARTIFACT_GENERATED_DUPLICATE');
for (const path of authorities) {
  if (generated.has(path)) throw new Error(`ARTIFACT_AUTHORITY_GENERATED_OVERLAP:${path}`);
  if (!existsSync(join(repositoryRoot, path))) throw new Error(`ARTIFACT_AUTHORITY_MISSING:${path}`);
}
for (const path of generated) {
  if (!existsSync(join(repositoryRoot, path))) throw new Error(`ARTIFACT_GENERATED_MISSING:${path}`);
}

const evidence = JSON.parse(readFileSync(join(repositoryRoot, manifest.eligibility.source), 'utf8'));
if (evidence.derived !== true || typeof evidence.releaseEligible !== 'boolean') {
  throw new Error('ARTIFACT_ELIGIBILITY_EVIDENCE_INVALID');
}
console.log(`selected artifacts locked: applications=${manifest.applications.length} service=1 releaseEligible=${evidence.releaseEligible}`);

function workspaceDirectories(parent) {
  const root = join(repositoryRoot, parent);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'package.json')))
    .map((entry) => relative(repositoryRoot, join(root, entry.name)).split('\\').join('/'))
    .sort();
}

function assertExact(kind, expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(`${kind}_ARTIFACT_SET_DRIFT:expected=${JSON.stringify(expected)}:actual=${JSON.stringify(actual)}`);
  }
}
