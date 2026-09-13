import { execFile } from 'node:child_process';

import { invariant } from '../../src/errors.mjs';

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

export async function runChannel(context, dependencies = {}) {
  const { adapter, manifest, options } = context;
  if (options.dryRun) {
    return result(context, {
      dryRun: true,
      intendedRoute: options.action === 'rollback' ? 'cloudflare-tunnel' : 'aliyun-cdn',
      manifest,
    });
  }

  const env = dependencies.env ?? process.env;
  const aliyun = dependencies.aliyun ?? await createAliyunClient(manifest, env);
  const cloudflare = dependencies.cloudflare ?? createCloudflareClient(manifest, env, dependencies.fetcher);
  const probe = dependencies.probe ?? curlProbe;

  if (options.action === 'establish') {
    await establishAliyunChannel(manifest, aliyun, env, dependencies.wait);
  }

  const before = await inspectChannel(manifest, { aliyun, cloudflare, probe });
  if (options.action === 'status' || options.action === 'establish') {
    invariant(options.action !== 'establish' || before.readyForCutover,
      'CHANNEL_NOT_READY', 'H6 CDN channel did not reach a cutover-ready state', before);
    return result(context, { state: before });
  }

  if (options.action === 'deploy') {
    invariant(/^[a-f0-9]{40}$/.test(options.sourceSha ?? ''),
      'CHANNEL_SOURCE_SHA_REQUIRED', 'H6 CDN deployment requires one full lowercase Git SHA');
    invariant(before.readyForCutover, 'CHANNEL_NOT_READY', 'H6 CDN channel is not ready for cutover', before);
    assertKnownRoute(before.dns, manifest, before.aliyun.cname);
    await cloudflare.updateCname(before.dns.id, {
      name: manifest.domain,
      content: before.aliyun.cname,
      ...manifest.cloudflare.production,
      comment: `H6 Alibaba Cloud CDN (${options.sourceSha.slice(0, 12)})`,
    });
    const after = await inspectChannel(manifest, { aliyun, cloudflare, probe });
    invariant(after.route === 'aliyun-cdn', 'CHANNEL_DNS_SWITCH_FAILED', 'Cloudflare DNS did not switch to Alibaba Cloud CDN', after);
    return result(context, { sourceSha: options.sourceSha, before, after });
  }

  assertKnownRoute(before.dns, manifest, before.aliyun.cname);
  await cloudflare.updateCname(before.dns.id, {
    name: manifest.domain,
    ...manifest.cloudflare.baseline,
    comment: 'H6 rollback route: Cloudflare Tunnel',
  });
  const after = await inspectChannel(manifest, { aliyun, cloudflare, probe });
  invariant(after.route === 'cloudflare-tunnel', 'CHANNEL_DNS_ROLLBACK_FAILED', 'Cloudflare DNS did not restore the H6 tunnel route', after);
  return result(context, { before, after });
}

export async function inspectChannel(manifest, { aliyun, cloudflare, probe }) {
  const [aliyunState, dns, originProbes] = await Promise.all([
    inspectAliyun(manifest, aliyun),
    cloudflare.getCname(manifest.domain),
    Promise.all(manifest.origin.probePaths.map(async (path) => ({
      path,
      ...await probe({
        url: `http://${manifest.origin.content}:${manifest.origin.port}${path}`,
        host: manifest.origin.host,
      }),
    }))),
  ]);
  const edgeProbes = aliyunState.cname && aliyunState.sslEnabled
    ? await Promise.all(manifest.origin.probePaths.map(async (path) => ({
      path,
      ...await probe({
        url: `https://${manifest.domain}${path}`,
        connectTo: aliyunState.cname,
        host: manifest.domain,
      }),
    })))
    : [];
  const route = classifyRoute(dns, manifest, aliyunState.cname);
  const originReady = originProbes.every(({ status }) => status === 200);
  const edgeReady = edgeProbes.length === manifest.origin.probePaths.length
    && edgeProbes.every(({ status }) => status === 200);
  return {
    aliyun: aliyunState,
    dns,
    route,
    probes: { origin: originProbes, edge: edgeProbes },
    readyForCutover: aliyunState.ready && originReady && edgeReady,
  };
}

export function classifyRoute(record, manifest, cdnCname) {
  if (sameDns(record, { name: manifest.domain, ...manifest.cloudflare.baseline })) return 'cloudflare-tunnel';
  if (cdnCname && sameDns(record, { name: manifest.domain, content: cdnCname, ...manifest.cloudflare.production })) return 'aliyun-cdn';
  return 'other';
}

async function inspectAliyun(manifest, aliyun) {
  const domain = await aliyun.findDomain(manifest.domain);
  if (!domain) {
    return { exists: false, ready: false, domain: manifest.domain, cname: null, status: 'missing', sslEnabled: false, sources: [], functions: [] };
  }
  const [detail, configurations] = await Promise.all([
    aliyun.describeDomain(manifest.domain),
    aliyun.describeConfigurations(manifest.domain, manifest.aliyun.functions.map(({ functionName }) => functionName)),
  ]);
  const sources = (detail.sourceModels?.sourceModel ?? []).map((source) => ({
    type: source.type,
    content: normalizedHost(source.content),
    port: Number(source.port),
    priority: String(source.priority),
    weight: String(source.weight),
    enabled: source.enabled,
  }));
  const functions = normalizeConfigurations(configurations);
  const sourceReady = sources.some((source) => source.type === manifest.origin.type
    && source.content === normalizedHost(manifest.origin.content)
    && source.port === manifest.origin.port);
  const functionsReady = manifest.aliyun.functions.every((expected) => hasConfiguration(functions, expected));
  const sslEnabled = detail.serverCertificateStatus === 'on';
  return {
    exists: true,
    ready: detail.domainStatus === 'online' && sslEnabled && sourceReady && functionsReady,
    domain: detail.domainName,
    cname: normalizedHost(detail.cname),
    status: detail.domainStatus,
    scope: detail.scope,
    cdnType: detail.cdnType,
    sslEnabled,
    sourceReady,
    functionsReady,
    sources,
    functions,
  };
}

async function establishAliyunChannel(manifest, aliyun, env, waiter = wait) {
  const existing = await aliyun.findDomain(manifest.domain);
  if (!existing) {
    await aliyun.addDomain({
      domainName: manifest.domain,
      cdnType: manifest.aliyun.cdnType,
      scope: manifest.aliyun.scope,
      sources: JSON.stringify([{
        type: manifest.origin.type,
        content: manifest.origin.content,
        port: manifest.origin.port,
        priority: '20',
        weight: '100',
      }]),
    });
    await waitForDomain(manifest.domain, aliyun, waiter);
  }
  await aliyun.setConfigurations(manifest.domain, manifest.aliyun.functions);
  const certificateId = Number(env[manifest.aliyun.certificate.idEnv]);
  invariant(Number.isSafeInteger(certificateId) && certificateId > 0,
    'ALIYUN_CDN_CERT_ID_MISSING', `${manifest.aliyun.certificate.idEnv} must identify the issued H6 certificate`);
  await aliyun.setCertificate({
    domainName: manifest.domain,
    SSLProtocol: 'on',
    certType: manifest.aliyun.certificate.type,
    certRegion: manifest.aliyun.certificate.region,
    certId: certificateId,
  });
  const configured = await aliyun.findDomain(manifest.domain);
  if (configured?.domainStatus !== 'online') {
    await aliyun.startDomain(manifest.domain);
  }
  await waitForDomain(manifest.domain, aliyun, waiter, ({ domainStatus }) => domainStatus === 'online');
}

async function waitForDomain(domain, aliyun, waiter, predicate = Boolean) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const current = await aliyun.findDomain(domain);
    if (current && predicate(current)) return current;
    await waiter(2_000);
  }
  throw new Error(`ALIYUN_CDN_DOMAIN_WAIT_TIMEOUT:${domain}`);
}

async function createAliyunClient(manifest, env) {
  const accessKeyId = requiredEnv(env, 'ALIYUN_CDN_ACCESS_KEY_ID');
  const accessKeySecret = requiredEnv(env, 'ALIYUN_CDN_ACCESS_KEY_SECRET');
  const [cdnModule, openApiModule] = await Promise.all([
    import('@alicloud/cdn20180510'),
    import('@alicloud/openapi-client'),
  ]);
  const Client = cdnModule.default?.default ?? cdnModule.default;
  const Config = openApiModule.Config ?? openApiModule.default?.Config;
  invariant(typeof Client === 'function' && typeof Config === 'function',
    'ALIYUN_CDN_SDK_INVALID', 'Alibaba Cloud CDN SDK exports are unavailable');
  const config = new Config({ accessKeyId, accessKeySecret, regionId: manifest.aliyun.regionId });
  config.endpoint = manifest.aliyun.endpoint;
  const client = new Client(config);
  const model = (name, values) => {
    const Constructor = cdnModule[name] ?? cdnModule.default?.[name];
    invariant(typeof Constructor === 'function', 'ALIYUN_CDN_SDK_INVALID', `Missing Alibaba Cloud CDN model ${name}`);
    return new Constructor(values);
  };
  return {
    async findDomain(domainName) {
      const response = await client.describeUserDomains(model('DescribeUserDomainsRequest', {
        domainName, domainSearchType: 'full_match', checkDomainShow: true, pageNumber: 1, pageSize: 20,
      }));
      return (response.body?.domains?.pageData ?? []).find((item) => item.domainName === domainName) ?? null;
    },
    async describeDomain(domainName) {
      const response = await client.describeCdnDomainDetail(model('DescribeCdnDomainDetailRequest', { domainName }));
      return response.body?.getDomainDetailModel;
    },
    async describeConfigurations(domainName, functionNames) {
      const response = await client.describeCdnDomainConfigs(model('DescribeCdnDomainConfigsRequest', {
        domainName, functionNames: functionNames.join(','),
      }));
      return response.body?.domainConfigs?.domainConfig ?? [];
    },
    async addDomain(values) {
      await client.addCdnDomain(model('AddCdnDomainRequest', values));
    },
    async setConfigurations(domainNames, functions) {
      await client.batchSetCdnDomainConfig(model('BatchSetCdnDomainConfigRequest', {
        domainNames, functions: JSON.stringify(functions),
      }));
    },
    async setCertificate(values) {
      await client.setCdnDomainSSLCertificate(model('SetCdnDomainSSLCertificateRequest', values));
    },
    async startDomain(domainName) {
      await client.startCdnDomain(model('StartCdnDomainRequest', { domainName }));
    },
  };
}

export function createCloudflareClient(manifest, env, fetcher = fetch) {
  const zoneId = requiredEnv(env, manifest.cloudflare.zoneIdEnv);
  const apiToken = requiredEnv(env, manifest.cloudflare.apiTokenEnv);
  async function request(method, path, body) {
    const response = await fetcher(`${CLOUDFLARE_API}${path}`, {
      method,
      headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    invariant(response.ok && payload?.success === true, 'CLOUDFLARE_DNS_REQUEST_FAILED',
      `Cloudflare DNS ${method} failed`, { status: response.status, errors: payload?.errors ?? [] });
    return payload.result;
  }
  return {
    async getCname(name) {
      const records = await request('GET', `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`);
      invariant(records.length === 1, 'CLOUDFLARE_DNS_RECORD_AMBIGUOUS', `Expected exactly one CNAME for ${name}`,
        { count: records.length });
      return normalizeDns(records[0]);
    },
    async updateCname(id, record) {
      return normalizeDns(await request('PATCH', `/zones/${zoneId}/dns_records/${id}`, record));
    },
  };
}

export async function curlProbe({ url, host, connectTo }) {
  const args = ['--silent', '--show-error', '--output', '/dev/null', '--write-out', '%{http_code}', '--max-time', '12'];
  if (host) args.push('--header', `Host: ${host}`);
  if (connectTo) args.push('--connect-to', `${host}:443:${connectTo}:443`);
  args.push(url);
  try {
    const { stdout } = await execFilePromise('curl', args);
    return { status: Number(stdout), ok: /^2\d\d$/.test(stdout) };
  } catch (error) {
    return { status: 0, ok: false, error: String(error.message ?? error).slice(-500) };
  }
}

function normalizeConfigurations(configurations) {
  return configurations.map((configuration) => ({
    functionName: configuration.functionName,
    status: configuration.status,
    functionArgs: (configuration.functionArgs?.functionArg ?? [])
      .map(({ argName, argValue }) => ({ argName, argValue: String(argValue) }))
      .sort(compareArgs),
  })).sort((left, right) => left.functionName.localeCompare(right.functionName));
}

function hasConfiguration(configurations, expected) {
  const expectedArgs = expected.functionArgs.map(({ argName, argValue }) => ({ argName, argValue: String(argValue) })).sort(compareArgs);
  return configurations.some((actual) => actual.functionName === expected.functionName
    && actual.status !== 'failed'
    && expectedArgs.every((expectedArg) => actual.functionArgs.some((actualArg) => compareArgs(actualArg, expectedArg) === 0)));
}

function compareArgs(left, right) {
  return left.argName.localeCompare(right.argName) || left.argValue.localeCompare(right.argValue);
}

function assertKnownRoute(record, manifest, cdnCname) {
  invariant(classifyRoute(record, manifest, cdnCname) !== 'other',
    'CHANNEL_DNS_ROUTE_CONFLICT', 'H6 DNS is neither the registered tunnel rollback route nor this CDN channel', record);
}

function sameDns(actual, expected) {
  return actual.type === expected.type
    && actual.name === normalizedHost(expected.name)
    && actual.content === normalizedHost(expected.content)
    && actual.proxied === expected.proxied
    && actual.ttl === expected.ttl;
}

function normalizeDns(record) {
  return {
    id: record.id,
    type: record.type,
    name: normalizedHost(record.name),
    content: normalizedHost(record.content),
    proxied: record.proxied === true,
    ttl: Number(record.ttl),
  };
}

function normalizedHost(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/\.$/, '') : null;
}

function requiredEnv(env, name) {
  const value = env[name];
  invariant(typeof value === 'string' && value.length > 0, 'CHANNEL_CREDENTIAL_MISSING', `${name} is required`);
  return value;
}

function result({ adapter, options }, details) {
  return {
    schema: 'ai.delivery.channel.v1',
    project: adapter.project,
    target: options.target,
    node: options.node,
    action: options.action,
    finalStatus: 'success',
    ...details,
    completedAt: new Date().toISOString(),
  };
}

function execFilePromise(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8', timeout: 15_000 }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}\n${stderr}`;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
