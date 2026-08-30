import { lstat, readFile } from 'node:fs/promises';
import { FULL_ROOT, canonical, digest, execute, matchEvidence } from './readiness-common.mjs';

export const FULL_UNIT_NAMES = Object.freeze([
  'zhudatuan-staging-full-postgres-proxy.service',
  'zhudatuan-staging-full-internal-runtime.service',
  'zhudatuan-staging-full-rds-init.service',
  'zhudatuan-staging-full-migration.service',
  'zhudatuan-staging-full-owner-bootstrap.service',
  'zhudatuan-staging-full-database-retire.service',
  'zhudatuan-staging-full-identity-api.service',
  'zhudatuan-staging-full-identity-notification-jobs.service',
  'zhudatuan-staging-full-jobs.service',
]);

const TOOLS = Object.freeze([
  { id: 'node', command: '/usr/bin/node', arguments: ['--version'], minimum: [22, 22, 0] },
  { id: 'systemd', command: '/usr/bin/systemctl', arguments: ['--version'], minimum: [252, 0, 0] },
  { id: 'systemd-analyze', command: '/usr/bin/systemd-analyze', arguments: ['--version'], minimum: [252, 0, 0] },
  { id: 'caddy', command: '/usr/bin/caddy', arguments: ['version'], minimum: [2, 8, 0] },
  { id: 'psql', command: '/usr/bin/psql', arguments: ['--version'], minimum: [16, 0, 0] },
  { id: 'pg_isready', command: '/usr/bin/pg_isready', arguments: ['--version'], minimum: [16, 0, 0] },
  { id: 'openssl', command: '/usr/bin/openssl', arguments: ['version'], minimum: [3, 0, 0] },
]);

export async function verifyLiveHostToolchain(evidence, observed) {
  const missing = [];
  const versions = {};
  try {
    for (const tool of TOOLS) {
      const result = await execute(tool.command, tool.arguments, { timeout: 10_000, maxBuffer: 1024 * 1024 });
      const output = `${result.stdout}\n${result.stderr}`.trim().replace(/\s+/gu, ' ');
      const version = parseVersion(output);
      if (!atLeast(version, tool.minimum)) throw new Error(`TOOL_VERSION_INVALID:${tool.id}`);
      versions[tool.id] = Object.freeze({ output, version: version.join('.') });
    }
    const unitPaths = FULL_UNIT_NAMES.map((name) => `${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/${name}`);
    const unitDigests = {};
    for (const [index, file] of unitPaths.entries()) {
      const information = await lstat(file);
      if (!information.isFile() || information.isSymbolicLink()) throw new Error('UNIT_SOURCE_INVALID');
      unitDigests[FULL_UNIT_NAMES[index]] = digest(await readFile(file));
    }
    await execute('/usr/bin/systemd-analyze', ['verify', ...unitPaths], { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    matchEvidence(evidence, 'hostConfiguration.hostToolchainSha256',
      digest(canonical({ unitDigests, versions })), missing, observed);
  } catch {
    missing.push('live:host-toolchain');
  }
  return missing;
}

function parseVersion(output) {
  const match = /(?:^|\s)v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/u.exec(output);
  if (!match) throw new Error('TOOL_VERSION_UNREADABLE');
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function atLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}
