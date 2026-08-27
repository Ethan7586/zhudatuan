import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'config', 'artifacts.json'), 'utf8'));
if (manifest.schema !== 'zhudatuan.artifacts.v1') throw new Error('ARTIFACT_MANIFEST_SCHEMA_INVALID');

const selectedApplications = [...manifest.canonical.applications, ...manifest.compatibility.applications].sort();
const selectedServices = [...manifest.canonical.services, ...manifest.compatibility.services].sort();
assertExact('APPLICATION', selectedApplications, workspaceDirectories('apps'));
assertExact('SERVICE', selectedServices, workspaceDirectories('services'));

for (const path of [...selectedApplications, ...selectedServices, manifest.canonical.database, manifest.compatibility.database]) {
  if (!existsSync(join(repositoryRoot, path))) throw new Error(`SELECTED_ARTIFACT_MISSING:${path}`);
}

if (manifest.canonical.releaseEligible !== false || manifest.compatibility.releaseEligible !== false) {
  throw new Error('UNVERIFIED_ARTIFACT_MARKED_RELEASE_ELIGIBLE');
}

console.log(`selected artifacts locked: applications=${selectedApplications.length} services=${selectedServices.length} releaseEligible=false`);

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
