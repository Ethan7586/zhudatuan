import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { classifyRoute, runChannel } from '../adapters/zdt-next/h6-cdn-channel.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const manifest = JSON.parse(await readFile(join(projectRoot,
  '02_platform_pingtai/infrastructure/projects_xiangmu/hbbtzn/deployment/h6-cdn.json'), 'utf8'));
const sourceSha = 'a'.repeat(40);

test('H6 channel reports a cutover-ready CDN while preserving the tunnel route', async () => {
  const fixture = createFixture('cloudflare-tunnel');
  fixture.configurations.find(({ functionName }) => functionName === 'https_option')
    .functionArgs.functionArg.push({ argName: 'cert_id', argValue: 'provider-managed' });
  const result = await runChannel(context('status'), fixture.dependencies);
  assert.equal(result.finalStatus, 'success');
  assert.equal(result.state.route, 'cloudflare-tunnel');
  assert.equal(result.state.readyForCutover, true);
  assert.deepEqual(result.state.probes.origin.map(({ status }) => status), [200, 200, 200]);
  assert.deepEqual(result.state.probes.edge.map(({ status }) => status), [200, 200, 200]);
});

test('H6 deploy and rollback switch only the registered CNAME route', async () => {
  const fixture = createFixture('cloudflare-tunnel');
  const deployed = await runChannel(context('deploy', { sourceSha }), fixture.dependencies);
  assert.equal(deployed.before.route, 'cloudflare-tunnel');
  assert.equal(deployed.after.route, 'aliyun-cdn');
  assert.equal(fixture.dns.content, fixture.cname);
  assert.equal(fixture.dns.proxied, false);
  assert.equal(fixture.dns.ttl, 60);

  const rolledBack = await runChannel(context('rollback'), fixture.dependencies);
  assert.equal(rolledBack.before.route, 'aliyun-cdn');
  assert.equal(rolledBack.after.route, 'cloudflare-tunnel');
  assert.equal(fixture.dns.content, manifest.cloudflare.baseline.content);
  assert.equal(fixture.dns.proxied, true);
  assert.equal(fixture.dns.ttl, 1);
});

test('H6 channel refuses an unrelated DNS route', async () => {
  const fixture = createFixture('other');
  await assert.rejects(
    runChannel(context('deploy', { sourceSha }), fixture.dependencies),
    ({ code }) => code === 'CHANNEL_DNS_ROUTE_CONFLICT',
  );
});

test('route classification distinguishes tunnel, CDN, and unrelated records', () => {
  const fixture = createFixture('cloudflare-tunnel');
  assert.equal(classifyRoute(fixture.dns, manifest, fixture.cname), 'cloudflare-tunnel');
  fixture.setRoute('aliyun-cdn');
  assert.equal(classifyRoute(fixture.dns, manifest, fixture.cname), 'aliyun-cdn');
  fixture.setRoute('other');
  assert.equal(classifyRoute(fixture.dns, manifest, fixture.cname), 'other');
});

test('establish keeps an already-online CDN domain online', async () => {
  const fixture = createFixture('cloudflare-tunnel');
  fixture.dependencies.env.ALIYUN_CDN_CERT_ID = '123';
  const established = await runChannel(context('establish'), fixture.dependencies);
  assert.equal(established.finalStatus, 'success');
  assert.equal(fixture.calls.setConfigurations, 1);
  assert.equal(fixture.calls.setCertificate, 1);
  assert.equal(fixture.calls.startDomain, 0);
});

function context(action, extra = {}) {
  return {
    adapter: { project: 'zdt-next' },
    channel: { id: 'h6-cdn' },
    manifest,
    options: { target: 'h6-cdn', node: 'hbbtzn-l1', action, ...extra },
  };
}

function createFixture(route) {
  const cname = 'h6.hbbtzn.com.w.kunlunaq.com';
  const calls = { setConfigurations: 0, setCertificate: 0, startDomain: 0 };
  const dns = { id: 'record-id', type: 'CNAME', name: manifest.domain, content: '', proxied: false, ttl: 60 };
  const setRoute = (next) => {
    if (next === 'cloudflare-tunnel') Object.assign(dns, { ...manifest.cloudflare.baseline, name: manifest.domain });
    else if (next === 'aliyun-cdn') Object.assign(dns, { ...manifest.cloudflare.production, name: manifest.domain, content: cname });
    else Object.assign(dns, { type: 'CNAME', name: manifest.domain, content: 'unrelated.example.com', proxied: false, ttl: 300 });
  };
  setRoute(route);
  const configurations = manifest.aliyun.functions.map((configuration) => ({
    functionName: configuration.functionName,
    status: 'success',
    functionArgs: { functionArg: configuration.functionArgs },
  }));
  const aliyun = {
    async findDomain() { return { domainName: manifest.domain, domainStatus: 'online', cname }; },
    async describeDomain() {
      return {
        domainName: manifest.domain,
        domainStatus: 'online',
        cname,
        scope: 'domestic',
        cdnType: 'web',
        serverCertificateStatus: 'on',
        sourceModels: { sourceModel: [{
          type: manifest.origin.type,
          content: manifest.origin.content,
          port: manifest.origin.port,
          priority: '20',
          weight: '100',
          enabled: 'online',
        }] },
      };
    },
    async describeConfigurations() { return configurations; },
    async setConfigurations() { calls.setConfigurations += 1; },
    async setCertificate() { calls.setCertificate += 1; },
    async startDomain() { calls.startDomain += 1; },
  };
  const cloudflare = {
    async getCname() { return { ...dns }; },
    async updateCname(id, record) { assert.equal(id, dns.id); Object.assign(dns, record); return { ...dns }; },
  };
  return {
    cname,
    calls,
    configurations,
    dns,
    setRoute,
    dependencies: {
      aliyun,
      cloudflare,
      probe: async () => ({ status: 200, ok: true }),
      env: {},
    },
  };
}
