import { lstat, readFile } from 'node:fs/promises';
import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { verifyCurrentReleaseIdentity } from './readiness-candidate.mjs';
import { verifyInstalledFullUnits } from './readiness-systemd.mjs';
import {
  FULL_ROOT,
  KNOWN_PRODUCTION_PUBLIC_ADDRESS_SHA256,
  canonical,
  digest,
  execute,
  internalStatus,
  matchEvidence,
  parseEnvironment,
  publicStagingHost,
  request,
  sameStrings,
  systemdState,
  valueAt,
} from './readiness-common.mjs';

export async function verifyLiveRuntime(evidence, observed) {
  const missing = [];
  try {
    await verifyCurrentReleaseIdentity(evidence);
  } catch {
    missing.push('live:current-release:identity');
  }
  const expectedActive = [
    'zhudatuan-staging-full-postgres-proxy.service',
    'zhudatuan-staging-full-internal-runtime.service',
    'zhudatuan-staging-full-identity-api.service',
    'zhudatuan-staging-full-identity-notification-jobs.service',
    'caddy.service',
  ];
  const systemd = [];
  const installedUnits = await verifyInstalledFullUnits();
  missing.push(...installedUnits.missing);
  for (const service of expectedActive) {
    try {
      const state = await systemdState(service);
      systemd.push(state.line);
      if (state.active !== 'active') missing.push(`live:systemd:${service}`);
    } catch {
      missing.push(`live:systemd:${service}`);
    }
  }
  try {
    const fullJobs = await systemdState('zhudatuan-staging-full-jobs.service');
    systemd.push(fullJobs.line);
    if (fullJobs.unitFile !== 'static') missing.push('live:systemd:full-jobs-install-state');
    if (fullJobs.active !== 'inactive' || fullJobs.sub !== 'dead' || fullJobs.result !== 'success') {
      missing.push('live:systemd:full-jobs-must-remain-inactive');
    }
  } catch {
    missing.push('live:systemd:zhudatuan-staging-full-jobs.service');
  }
  matchEvidence(evidence, 'runtime.systemdStateSha256',
    digest(JSON.stringify({ installedUnitInventorySha256: installedUnits.digest, runtimeStates: systemd.sort() })), missing, observed);

  try {
    const output = (await execute('/usr/bin/ss', ['-lntH'])).stdout;
    const ports = ['55442', '8643', '8644', '8645', '4431'];
    const listeners = output.split(/\r?\n/u).filter((line) => ports.some((port) => new RegExp(`:${port}(?:\\s|$)`, 'u').test(line))).sort();
    for (const port of ports) {
      const selected = listeners.filter((line) => new RegExp(`:${port}(?:\\s|$)`, 'u').test(line));
      if (selected.length !== 1 || !new RegExp(`(?:^|\\s)127\\.0\\.0\\.1:${port}(?:\\s|$)`, 'u').test(selected[0])) {
        missing.push(`live:listener:${port}`);
      }
    }
    matchEvidence(evidence, 'runtime.listenerInventorySha256', digest(listeners.join('\n')), missing, observed);
  } catch {
    missing.push('live:listeners');
  }

  await verifyInternalAccessProbes(evidence, missing, observed);
  const hosts = {
    accounts: valueAt(evidence, 'runtime.accountsHost'),
    console: valueAt(evidence, 'runtime.consoleHost'),
    api: valueAt(evidence, 'runtime.apiHost'),
  };
  if (!Object.values(hosts).every(publicStagingHost) || new Set(Object.values(hosts)).size !== 3) {
    missing.push('live:public-hosts');
    return missing;
  }
  await verifyPublicDns(evidence, hosts, missing, observed);
  try {
    const candidateCaddyFile = `${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/Caddyfile.full`;
    const candidateDropIn = `${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/caddy-zhudatuan-staging-full.conf`;
    const activeCaddyFile = '/etc/caddy/Caddyfile';
    const activeDropIn = '/etc/systemd/system/caddy.service.d/zhudatuan-staging-full.conf';
    const environmentFile = `${FULL_ROOT}/shared/full-caddy.env`;
    const [candidateSource, activeSource, candidateDropInSource, activeDropInSource, environmentSource,
      activeMetadata, dropInMetadata, environmentMetadata, caddyDirectory, dropInDirectory, caddyUnit] = await Promise.all([
      readFile(candidateCaddyFile, 'utf8'),
      readFile(activeCaddyFile, 'utf8'),
      readFile(candidateDropIn, 'utf8'),
      readFile(activeDropIn, 'utf8'),
      readFile(environmentFile, 'utf8'),
      lstat(activeCaddyFile),
      lstat(activeDropIn),
      lstat(environmentFile),
      lstat('/etc/caddy'),
      lstat('/etc/systemd/system/caddy.service.d'),
      execute('/usr/bin/systemctl', ['show', 'caddy.service', '--no-pager', '--property=FragmentPath',
        '--property=DropInPaths', '--property=NeedDaemonReload', '--property=EnvironmentFiles',
        '--property=ExecStart']).then(({ stdout }) => parseSystemdProperties(stdout)),
    ]);
    const activeMode = activeMetadata.mode & 0o777;
    const dropInMode = dropInMetadata.mode & 0o777;
    const environmentMode = environmentMetadata.mode & 0o777;
    const environment = parseEnvironment(environmentSource);
    const expectedEnvironment = {
      ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST: hosts.accounts,
      ZHUDATUAN_STAGING_FULL_CONSOLE_HOST: hosts.console,
      ZHUDATUAN_STAGING_FULL_API_HOST: hosts.api,
    };
    if (candidateSource !== activeSource || candidateDropInSource !== activeDropInSource
      || !activeMetadata.isFile() || activeMetadata.isSymbolicLink() || activeMetadata.uid !== 0
      || activeMetadata.gid !== 0 || activeMode !== 0o644
      || !dropInMetadata.isFile() || dropInMetadata.isSymbolicLink() || dropInMetadata.uid !== 0
      || dropInMetadata.gid !== 0 || dropInMode !== 0o644
      || !environmentMetadata.isFile() || environmentMetadata.isSymbolicLink() || environmentMetadata.uid !== 0
      || environmentMetadata.gid !== 0 || environmentMode !== 0o600
      || !safeRootDirectory(caddyDirectory, 0o755) || !safeRootDirectory(dropInDirectory, 0o755)
      || !sameStrings(Object.keys(environment), Object.keys(expectedEnvironment))
      || Object.entries(expectedEnvironment).some(([key, value]) => environment[key] !== value)
      || !['/lib/systemd/system/caddy.service', '/usr/lib/systemd/system/caddy.service'].includes(caddyUnit.FragmentPath)
      || caddyUnit.NeedDaemonReload !== 'no'
      || !sameStrings(absolutePaths(caddyUnit.DropInPaths), [activeDropIn])
      || !sameStrings(absolutePaths(caddyUnit.EnvironmentFiles), [environmentFile])
      || !caddyUnit.ExecStart.includes('/usr/bin/caddy') || !caddyUnit.ExecStart.includes(activeCaddyFile)
      || /(?:accounts|console|api)\.zhudatuan\.com/iu.test(activeSource)
      || /^\s*import(?:\s|$)/imu.test(activeSource)) {
      throw new Error('ACTIVE_CADDY_CONFIGURATION_MISMATCH');
    }
    await execute('/usr/bin/caddy', ['validate', '--config', activeCaddyFile, '--adapter', 'caddyfile'], {
      env: {
        ...process.env,
        ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST: hosts.accounts,
        ZHUDATUAN_STAGING_FULL_CONSOLE_HOST: hosts.console,
        ZHUDATUAN_STAGING_FULL_API_HOST: hosts.api,
      },
    });
    matchEvidence(evidence, 'runtime.caddyValidationSha256', digest(canonical({
      activeSource,
      dropInSource: activeDropInSource,
      environment,
      systemd: caddyUnit,
    })), missing, observed);
  } catch {
    missing.push('live:caddy-validation');
  }

  try {
    const localHealth = await request('http://127.0.0.1:4431/health/ready', 200);
    await request(`https://${hosts.accounts}/`, 200);
    await request(`https://${hosts.console}/`, 200);
    await request(`https://${hosts.api}/health/ready`, 200);
    const negative = await request(`https://${hosts.api}/__readiness_negative__`, 404);
    matchEvidence(evidence, 'database.runtimeCompatibilitySha256', digest(localHealth), missing, observed);
    matchEvidence(evidence, 'runtime.publicNegativeRouteSha256', digest(`${hosts.api}:404:${negative}`), missing, observed);
  } catch {
    missing.push('live:http');
  }
  return missing;
}

async function verifyPublicDns(evidence, hosts, missing, observed) {
  try {
    const resolutions = {};
    for (const [name, host] of Object.entries(hosts)) {
      const [ipv4, ipv6] = await Promise.all([resolve4(host), optionalIpv6(host)]);
      const addresses = [...new Set([...ipv4, ...ipv6])].sort();
      if (addresses.length !== 1 || isIP(addresses[0]) !== 4
        || digest(addresses[0]) === KNOWN_PRODUCTION_PUBLIC_ADDRESS_SHA256) {
        throw new Error('PUBLIC_DNS_ADDRESS_INVALID');
      }
      resolutions[name] = Object.freeze({ host, addresses });
    }
    const addressSets = Object.values(resolutions).map(({ addresses }) => canonical(addresses));
    if (new Set(addressSets).size !== 1) throw new Error('PUBLIC_DNS_SPLIT_TARGET');
    const publicAddress = Object.values(resolutions)[0].addresses[0];
    matchEvidence(evidence, 'network.publicAddressFingerprint', digest(publicAddress), missing, observed);
    matchEvidence(evidence, 'runtime.dnsResolutionSha256', digest(canonical(resolutions)), missing, observed);
  } catch {
    missing.push('live:public-dns');
  }
}

async function optionalIpv6(host) {
  try {
    return await resolve6(host);
  } catch (cause) {
    if (cause?.code === 'ENODATA' || cause?.code === 'ENOTFOUND') return [];
    throw cause;
  }
}

function parseSystemdProperties(source) {
  return Object.fromEntries(source.trimEnd().split(/\r?\n/u).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function absolutePaths(value) {
  return [...value.matchAll(/\/[A-Za-z0-9._/-]+/gu)].map((match) => match[0]);
}

function safeRootDirectory(information, expectedMode) {
  return information.isDirectory() && !information.isSymbolicLink() && information.uid === 0
    && information.gid === 0 && (information.mode & 0o777) === expectedMode;
}

async function verifyInternalAccessProbes(evidence, missing, observed) {
  const lines = [];
  try {
    const shared = `${FULL_ROOT}/shared`;
    const [ca, policy, environment] = await Promise.all([
      readFile(`${shared}/tls/internal-ca.crt`),
      readFile(`${shared}/full-internal-access.json`, 'utf8').then(JSON.parse),
      readFile(`${shared}/full-internal-runtime.env`, 'utf8').then(parseEnvironment),
    ]);
    if (policy.phase !== 'runtime') throw new Error('RUNTIME_POLICY_REQUIRED');
    for (const [workload, grant] of Object.entries(policy.secretStore)) {
      const allowed = grant.resources[0];
      const permitted = await internalStatus(8643, `/v1/secrets/${encodeURIComponent(allowed)}`, grant.bearerToken, ca);
      const denied = await internalStatus(8643, '/v1/secrets/zhudatuan%2Fstaging%2Ffull%2Fforbidden%2Freadiness', grant.bearerToken, ca);
      lines.push(`secret:${workload}:${permitted}:${denied}`);
      if (permitted !== 200 || denied !== 403) missing.push(`live:secret-store-acl:${workload}`);
    }
    const kmsBody = (keyRef) => JSON.stringify({ keyRef, plaintext: 'readiness-probe', context: { probe: 'p10' } });
    for (const [workload, grant] of Object.entries(policy.kms)) {
      const permitted = await internalStatus(8644, '/v1/envelopes', grant.bearerToken, ca, 'POST', kmsBody(grant.resources[0]));
      const denied = await internalStatus(8644, '/v1/envelopes', grant.bearerToken, ca, 'POST', kmsBody('readiness/forbidden'));
      lines.push(`kms:${workload}:${permitted}:${denied}`);
      if (permitted !== 200 || denied !== 403) missing.push(`live:kms-acl:${workload}`);
    }
    const objectToken = environment.LOCAL_OBJECTS_TOKEN;
    const policyToken = Object.values(policy.secretStore)[0]?.bearerToken;
    const objectAllowed = await internalStatus(8645, '/v1/objects/metadata?path=readiness%2Fp10', objectToken, ca);
    const objectDenied = await internalStatus(8645, '/v1/objects/metadata?path=readiness%2Fp10', policyToken, ca);
    const secretDenied = await internalStatus(8643, '/v1/secrets/zhudatuan%2Fstaging%2Ffull%2Fdatabase%2Fidentity-api', objectToken, ca);
    lines.push(`object:${objectAllowed}:${objectDenied}:secret-cross:${secretDenied}`);
    if (objectAllowed !== 404 || objectDenied !== 401 || secretDenied !== 401) missing.push('live:object-store:authenticated-probe');
    matchEvidence(evidence, 'runtime.internalAccessProbeSha256', digest(lines.sort().join('\n')), missing, observed);
  } catch {
    missing.push('live:internal-access-probe');
  }
}
