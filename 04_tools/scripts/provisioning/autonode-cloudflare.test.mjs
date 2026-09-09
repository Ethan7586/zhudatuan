import assert from 'node:assert/strict';
import test from 'node:test';

import { AutoNodeCloudflareClient } from './autonode-cloudflare.mjs';

test('Cloudflare executor creates and recovers one local tunnel and exact proxied CNAMEs', async () => {
  const api = cloudflareFixture();
  const client = new AutoNodeCloudflareClient({
    accountId: 'account00000001',
    zoneId: 'zone00000000001',
    apiToken: 'token-for-tests',
    fetcher: api.fetch,
  });

  const createdTunnel = await client.ensureTunnel('autonode-generated-l1', 'c2VjcmV0');
  assert.deepEqual(createdTunnel, { id: '11111111-1111-4111-8111-111111111111', name: 'autonode-generated-l1', created: true });
  assert.deepEqual(await client.ensureTunnel('autonode-generated-l1', 'c2VjcmV0'), {
    id: createdTunnel.id,
    name: createdTunnel.name,
    created: false,
  });

  const target = `${createdTunnel.id}.cfargotunnel.com`;
  const createdDns = await client.ensureCname('api.generated.invalid', target, 'AutoNode test');
  assert.equal(createdDns.created, true);
  const recoveredDns = await client.ensureCname('api.generated.invalid', target, 'AutoNode test');
  assert.equal(recoveredDns.created, false);
  assert.equal(recoveredDns.comment, 'AutoNode test');
  assert.equal(api.tunnels.size, 1);
  assert.equal(api.records.size, 1);

  await client.deleteDnsRecord(createdDns.id);
  await client.deleteDnsRecord(createdDns.id);
  await client.deleteTunnel(createdTunnel.id);
  await client.deleteTunnel(createdTunnel.id);
  assert.equal(api.tunnels.size, 0);
  assert.equal(api.records.size, 0);
  assert(api.requests.every(({ authorization }) => authorization === 'Bearer token-for-tests'));
});

test('Cloudflare executor refuses to overwrite an existing DNS route', async () => {
  const api = cloudflareFixture();
  api.records.set('api.generated.invalid', {
    id: 'dnsrecord0000001',
    type: 'CNAME',
    name: 'api.generated.invalid',
    content: 'different.cfargotunnel.com',
    proxied: true,
  });
  const client = new AutoNodeCloudflareClient({
    accountId: 'account00000001',
    zoneId: 'zone00000000001',
    apiToken: 'token-for-tests',
    fetcher: api.fetch,
  });
  await assert.rejects(
    client.ensureCname('api.generated.invalid', '11111111-1111-4111-8111-111111111111.cfargotunnel.com', 'AutoNode test'),
    /AUTONODE_CLOUDFLARE_DNS_CONFLICT/,
  );
});

function cloudflareFixture() {
  const tunnels = new Map();
  const records = new Map();
  const requests = [];
  let dnsSequence = 0;
  const fetch = async (url, init) => {
    const parsed = new URL(url);
    const authorization = init.headers.authorization;
    requests.push({ method: init.method, path: parsed.pathname, authorization });
    const success = (result, status = 200) => new Response(JSON.stringify({ success: true, result, errors: [], messages: [] }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
    const missing = () => new Response(JSON.stringify({ success: false, result: null, errors: [{ code: 1000, message: 'not found' }] }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
    if (init.method === 'GET' && parsed.pathname.endsWith('/cfd_tunnel')) {
      const name = parsed.searchParams.get('name');
      return success([...tunnels.values()].filter((tunnel) => tunnel.name === name));
    }
    if (init.method === 'POST' && parsed.pathname.endsWith('/cfd_tunnel')) {
      const body = JSON.parse(init.body);
      const tunnel = { id: '11111111-1111-4111-8111-111111111111', name: body.name, deleted_at: null };
      tunnels.set(tunnel.id, tunnel);
      return success(tunnel, 200);
    }
    if (init.method === 'DELETE' && parsed.pathname.includes('/cfd_tunnel/')) {
      const id = parsed.pathname.split('/').at(-1);
      if (!tunnels.delete(id)) return missing();
      return success({ id });
    }
    if (init.method === 'GET' && parsed.pathname.endsWith('/dns_records')) {
      const name = parsed.searchParams.get('name');
      return success(records.has(name) ? [records.get(name)] : []);
    }
    if (init.method === 'POST' && parsed.pathname.endsWith('/dns_records')) {
      const body = JSON.parse(init.body);
      const record = { id: `dnsrecord${String(++dnsSequence).padStart(7, '0')}`, ...body };
      records.set(record.name, record);
      return success(record, 200);
    }
    if (init.method === 'DELETE' && parsed.pathname.includes('/dns_records/')) {
      const id = parsed.pathname.split('/').at(-1);
      const match = [...records.entries()].find(([, record]) => record.id === id);
      if (!match) return missing();
      records.delete(match[0]);
      return success({ id });
    }
    throw new Error(`unexpected Cloudflare request ${init.method} ${parsed.pathname}`);
  };
  return { fetch, tunnels, records, requests };
}
