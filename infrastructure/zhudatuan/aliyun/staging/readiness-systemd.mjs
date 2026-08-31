import { lstat, readFile } from 'node:fs/promises';
import { FULL_ROOT, canonical, digest, execute, sameStrings } from './readiness-common.mjs';
import { FULL_UNIT_NAMES } from './readiness-toolchain.mjs';

const EXECUTABLE_MARKERS = Object.freeze({
  'zhudatuan-staging-full-postgres-proxy.service': 'services/commerce/dist/PostgresTlsProxyMain.js',
  'zhudatuan-staging-full-internal-runtime.service': 'services/commerce/dist/InternalRuntimeMain.js',
  'zhudatuan-staging-full-rds-init.service': 'postgres-init-registration.sh',
  'zhudatuan-staging-full-migration.service': 'services/commerce/dist/MigrationMain.js',
  'zhudatuan-staging-full-owner-bootstrap.service': 'services/commerce/dist/BootstrapStagingOwner.js',
  'zhudatuan-staging-full-database-retire.service': 'postgres-retire-registration-bootstrap.sql',
  'zhudatuan-staging-full-identity-api.service': 'services/commerce/dist/IdentityRegistrationApiMain.js',
  'zhudatuan-staging-full-identity-notification-jobs.service': 'services/commerce/dist/IdentityNotificationJobsOnlyMain.js',
  'zhudatuan-staging-full-jobs.service': 'services/commerce/dist/JobsMain.js',
});

const PERSISTENT_UNITS = new Set([
  'zhudatuan-staging-full-postgres-proxy.service',
  'zhudatuan-staging-full-internal-runtime.service',
]);

const PROPERTIES = Object.freeze([
  'LoadState', 'UnitFileState', 'FragmentPath', 'DropInPaths', 'NeedDaemonReload',
  'DynamicUser', 'SupplementaryGroups', 'EnvironmentFiles', 'LoadCredential', 'ExecStart',
]);

export async function verifyInstalledFullUnits() {
  const missing = [];
  const inventory = [];
  for (const name of FULL_UNIT_NAMES) {
    try {
      inventory.push(await verifyInstalledUnit(name));
    } catch {
      missing.push(`live:systemd:${name}:provenance`);
    }
  }
  return Object.freeze({ missing, digest: digest(canonical(inventory.sort((left, right) => left.name.localeCompare(right.name)))) });
}

async function verifyInstalledUnit(name) {
  const sourcePath = `${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/${name}`;
  const installedPath = `/etc/systemd/system/${name}`;
  const [source, installed, metadata, properties] = await Promise.all([
    readFile(sourcePath),
    readFile(installedPath),
    lstat(installedPath),
    systemdProperties(name),
  ]);
  const mode = metadata.mode & 0o777;
  const expectedUnitFileState = PERSISTENT_UNITS.has(name) ? 'enabled' : 'static';
  if (!source.equals(installed) || !metadata.isFile() || metadata.isSymbolicLink()
    || metadata.uid !== 0 || metadata.gid !== 0 || mode !== 0o644
    || properties.LoadState !== 'loaded' || properties.UnitFileState !== expectedUnitFileState
    || properties.FragmentPath !== installedPath || properties.DropInPaths !== ''
    || properties.NeedDaemonReload !== 'no' || properties.DynamicUser !== 'yes'
    || properties.SupplementaryGroups !== '' || !properties.ExecStart.includes(EXECUTABLE_MARKERS[name])) {
    throw new Error('INSTALLED_UNIT_BOUNDARY_INVALID');
  }
  const text = source.toString('utf8');
  const expectedEnvironments = directives(text, 'EnvironmentFile').map(stripOptionalPrefix);
  const expectedCredentials = directives(text, 'LoadCredential').map((value) => value.slice(value.indexOf(':') + 1));
  if (!sameStrings(absolutePaths(properties.EnvironmentFiles), expectedEnvironments)
    || !sameStrings(absolutePaths(properties.LoadCredential), expectedCredentials)) {
    throw new Error('INSTALLED_UNIT_INPUT_BOUNDARY_INVALID');
  }
  return Object.freeze({
    name,
    sourceSha256: digest(source),
    fragmentPath: properties.FragmentPath,
    environmentFiles: expectedEnvironments.sort(),
    credentialSources: expectedCredentials.sort(),
    dynamicUser: properties.DynamicUser,
    unitFileState: properties.UnitFileState,
  });
}

async function systemdProperties(name) {
  const argumentsList = ['show', name, '--no-pager', ...PROPERTIES.map((property) => `--property=${property}`)];
  const output = (await execute('/usr/bin/systemctl', argumentsList, { timeout: 10_000, maxBuffer: 1024 * 1024 })).stdout;
  return Object.fromEntries(output.trimEnd().split(/\r?\n/u).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function directives(source, name) {
  const expression = new RegExp(`^${name}=(.+)$`, 'gmu');
  return [...source.matchAll(expression)].map((match) => match[1].trim());
}

function stripOptionalPrefix(value) {
  return value.startsWith('-') ? value.slice(1) : value;
}

function absolutePaths(value) {
  return [...value.matchAll(/\/[A-Za-z0-9._/-]+/gu)].map((match) => match[0]);
}
