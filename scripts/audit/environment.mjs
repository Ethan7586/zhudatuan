import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

import { productionSources, relative, root } from '../check/source.mjs';
import { report } from './report.mjs';

const configRoot = 'packages/config/src/';
const config = productionSources()
  .filter((file) => relative(file).startsWith(configRoot))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const declared = new Set([...config.matchAll(/['"]([A-Z][A-Z0-9_]{2,})['"]/g)].map((match) => match[1]));
const violations = [];
const directRead = /(?:process\.env|import\.meta\.env)(?:\.([A-Z][A-Z0-9_]*)|\[['"]([A-Z][A-Z0-9_]*)['"]\])/g;
const releaseEnvironment = '/opt/smart-wiston/current/deployment/release.env';
const releaseVersionConsumers = new Map([
  ['api', '/opt/smart-wiston/shared/config/api.env'],
  ['jobs', '/opt/smart-wiston/shared/config/jobs.env'],
  ['provider', '/opt/smart-wiston/shared/config/provider.env'],
  ['migration', '/opt/smart-wiston/shared/config/migration.env'],
  ['providercatalog', '/opt/smart-wiston/shared/config/migration.env'],
  ['seed', '/opt/smart-wiston/shared/config/seed.env'],
]);

for (const file of productionSources()) {
  const name = relative(file);
  const source = readFileSync(file, 'utf8');
  for (const pattern of [directRead]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const key = match[1] ?? match[2];
      if (!declared.has(key)) violations.push({ code: 'ENVIRONMENT_KEY_UNDECLARED', location: name, detail: key });
      if (!name.startsWith(configRoot)) violations.push({ code: 'ENVIRONMENT_READ_OUTSIDE_OWNER', location: name, detail: key });
    }
  }
  if (!name.startsWith(configRoot) && /(?:process\.env|import\.meta\.env)\s*\[/.test(source)) {
    violations.push({ code: 'ENVIRONMENT_DYNAMIC_READ', location: name, detail: 'dynamic environment lookup' });
  }
}

const composeLocation = 'infrastructure/container/singlehost/compose.yml';
const compose = parse(readFileSync(join(root, composeLocation), 'utf8'), { merge: true });
if (compose['x-release-environment'] !== releaseEnvironment) {
  violations.push({ code: 'RELEASE_ENVIRONMENT_PATH_DRIFT', location: composeLocation, detail: releaseEnvironment });
}
for (const [service, sharedEnvironment] of releaseVersionConsumers) {
  const configured = compose.services?.[service]?.env_file;
  const environmentFiles = Array.isArray(configured) ? configured : configured ? [configured] : [];
  if (environmentFiles[0] !== sharedEnvironment) {
    violations.push({ code: 'SHARED_ENVIRONMENT_PATH_DRIFT', location: composeLocation, detail: `${service}:${sharedEnvironment}` });
  }
  if (environmentFiles.at(-1) !== releaseEnvironment) {
    violations.push({ code: 'RELEASE_ENVIRONMENT_NOT_AUTHORITATIVE', location: composeLocation, detail: service });
  }
}

const releaseLocation = 'scripts/release/singlehost.mjs';
const releaseSource = readFileSync(join(root, releaseLocation), 'utf8');
if (!/writeFileSync\(join\(outputRoot, 'deployment', 'release\.env'\), `SERVICE_VERSION=\$\{version\}\\n`/.test(releaseSource)) {
  violations.push({ code: 'RELEASE_ENVIRONMENT_NOT_GENERATED', location: releaseLocation, detail: 'deployment/release.env' });
}

report('environment', violations);
