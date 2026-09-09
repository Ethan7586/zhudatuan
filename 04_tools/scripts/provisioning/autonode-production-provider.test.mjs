import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readlink, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  AUTONODE_ACTIVATION_REQUEST_SCHEMA_VERSION,
  NodeActivationEngine,
} from './autonode-activation-engine.mjs';
import { AUTONODE_REQUEST_SCHEMA_VERSION } from './autonode-engine.mjs';
import {
  AUTONODE_RUNTIME_PROFILE_SCHEMA_VERSION,
  ProductionNodeActivationProvider,
} from './autonode-production-provider.mjs';

const TEMPLATE_NAMES = [
  'sfl-api-gateway@.service',
  'sfl-catalog-api@.service',
  'sfl-catalog-jobs@.service',
  'sfl-catalog-object-store@.service',
  'sfl-cloudflared@.service',
  'sfl-identity-api@.service',
  'sfl-purchase-api@.service',
  'sfl-storefront@.service',
  'sfl-web-api@.service',
];

test('production provider materializes, activates, rolls back, and restores one generated node', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'autonode-production-provider-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const fixture = await prepareFixture(root);
  const provider = new ProductionNodeActivationProvider(join(root, 'provider-state'), {
    fetcher: fixture.fetcher,
    runner: fixture.runner,
    publicDnsLookup: fixture.publicDnsLookup,
    environment: {
      TEST_CLOUDFLARE_TOKEN: 'test-cloudflare-token',
      TEST_IDENTITY_DATABASE_URL: 'postgresql://fixture.invalid/autonode',
    },
    identityRegistry: fixture.identityRegistry,
  });
  const request = activationRequest(root);
  const engine = new NodeActivationEngine(join(root, 'activation-state'), provider);

  const planned = await engine.plan(request);
  const validProfile = await readFile(request.target.runtime_profile_ref, 'utf8');
  const invalidProfile = JSON.parse(validProfile);
  invalidProfile.services['identity-api'].SESSION_KEY_REF = 'another-node/nodes/l1/identity/session';
  await writeFile(request.target.runtime_profile_ref, `${JSON.stringify(invalidProfile, null, 2)}\n`);
  assert((await provider.preflight({ request, plan: planned.plan, candidate: planned.candidate }))
    .includes('runtime-secret-binding:identity-api:SESSION_KEY_REF'));
  await writeFile(request.target.runtime_profile_ref, validProfile);
  assert.deepEqual(await provider.preflight({ request, plan: planned.plan, candidate: planned.candidate }), []);
  const interruptedRuntimeRollback = await provider.rollbackInterrupted(
    'RUNTIME_CONFIGURED',
    { request, plan: planned.plan, candidate: planned.candidate },
    'fixture-interrupted-runtime',
    'fixture-interrupted-runtime:rollback',
  );
  assert.equal(interruptedRuntimeRollback.status, 'ROLLED_BACK');
  assert.equal(interruptedRuntimeRollback.step, 'RUNTIME_CONFIGURED');
  const active = await engine.apply(request, planned.plan.plan_digest);
  assert.equal(active.ledger.status, 'ACTIVE');
  assert.equal(active.ledger.step_receipts.length, 11);
  assert.equal(await readlink(join(active.plan.node_directory, 'current')), request.target.release_directory);
  const manifest = JSON.parse(await readFile(join(active.plan.node_directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.lifecycle_status, 'active');
  assert(manifest.enabled_features.some(({ ref }) => ref === 'feature:catalog'));
  assert(manifest.enabled_features.some(({ ref }) => ref === 'feature:checkout'));
  assert.equal(fixture.cloudflare.tunnels.size, 1);
  assert.equal(fixture.cloudflare.records.size, 4);
  assert.equal(fixture.identityFacts.get(request.activation_request_id).status, 'active');
  assert(fixture.activeUnits.size > 0);
  assert.deepEqual(fixture.publicDnsLookups, ['api.generated-provider.invalid']);
  assert.equal((await stat(active.plan.node_directory)).mode & 0o777, 0o755);
  for (const directory of [
    join(active.plan.node_directory, 'runtime'),
    join(active.plan.node_directory, 'runtime', 'tls'),
    join(active.plan.node_directory, 'tunnel'),
  ]) assert.equal((await stat(directory)).mode & 0o777, 0o750);
  for (const directory of ['caddy-data', 'caddy-config']) {
    assert.equal((await stat(join(active.plan.node_directory, 'runtime', directory))).mode & 0o777, 0o770);
  }
  assert.equal((await stat(join(active.plan.node_directory, 'manifest.json'))).mode & 0o777, 0o644);
  const identityEnvironment = await readFile(join(active.plan.node_directory, 'runtime', 'identity-api.env'), 'utf8');
  assert.match(identityEnvironment, new RegExp(`^NODE_RELEASE_POINTER_REF="${manifest.release_pointer_ref.ref}"$`, 'm'));
  assert.match(identityEnvironment, new RegExp(`^SESSION_KEY_REF="${request.provisioning_request.node_slug}/nodes/l1/identity/session"$`, 'm'));
  const cloudflared = await readFile(join(active.plan.node_directory, 'runtime', 'cloudflared.yml'), 'utf8');
  assert(!cloudflared.includes(planned.candidate.nodeDirectory));
  assert(cloudflared.includes(`${active.plan.node_directory}/tunnel/credentials.json`));
  assert(cloudflared.includes(`${active.plan.node_directory}/runtime/tls/origin-ca.crt`));

  const rollback = await engine.rollback(request, 'provider isolation proof');
  assert.equal(rollback.ledger.status, 'ROLLED_BACK');
  assert.equal(fixture.cloudflare.tunnels.size, 0);
  assert.equal(fixture.cloudflare.records.size, 0);
  assert.equal(fixture.identityFacts.get(request.activation_request_id).status, 'disabled');
  await assert.rejects(readFile(join(active.plan.node_directory, 'manifest.json')), /ENOENT/);

  const restored = await engine.restore(request, planned.plan.plan_digest);
  assert.equal(restored.ledger.status, 'ACTIVE');
  assert.equal(restored.ledger.generation, 2);
  assert.equal(fixture.cloudflare.tunnels.size, 1);
  assert.equal(fixture.cloudflare.records.size, 4);
  assert.equal(fixture.identityFacts.get(request.activation_request_id).status, 'active');
});

async function prepareFixture(root) {
  const release = join(root, 'release');
  const templateRoot = join(release, '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd');
  const systemdRoot = join(root, 'systemd');
  await mkdir(templateRoot, { recursive: true });
  await mkdir(systemdRoot, { recursive: true });
  const repositoryTemplateRoot = resolve('02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd');
  for (const template of TEMPLATE_NAMES) await cp(join(repositoryTemplateRoot, template), join(templateRoot, template));

  const commands = {};
  for (const name of ['systemctl', 'caddy', 'cloudflared', 'curl', 'chown']) {
    const file = join(root, 'commands', name);
    await mkdir(join(root, 'commands'), { recursive: true });
    await writeFile(file, '# fixture\n');
    commands[name] = file;
  }
  const tlsRoot = join(root, 'tls');
  await mkdir(tlsRoot, { recursive: true });
  for (const name of ['origin.crt', 'origin.key', 'origin-ca.crt']) await writeFile(join(tlsRoot, name), `${name}-fixture\n`);

  const token = (letter) => letter.repeat(48);
  await writeFile(join(root, 'runtime-profile.json'), `${JSON.stringify({
    schema_version: AUTONODE_RUNTIME_PROFILE_SCHEMA_VERSION,
    profile_id: 'fixture-profile',
    environment: 'staging',
    services: {
      storefront: {},
      'catalog-api': {
        DATABASE_API_CONNECTION_REF: '{node_token}/database/catalog-api',
        DATABASE_API_ROLE: 'zhudatuanidentityapi',
        OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8655',
        OBJECT_STORE_BEARER_TOKEN: token('O'),
        SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
        SECRET_STORE_BEARER_TOKEN: token('C'),
      },
      'web-api': {
        PUBLIC_MALL_SLUG: '{public_slug}',
        DATABASE_API_CONNECTION_REF: '{node_token}/database/web-api',
        DATABASE_API_ROLE: 'zhudatuanwebapi',
        KMS_ENDPOINT: 'https://127.0.0.1:8544',
        KMS_BEARER_TOKEN: token('W'),
        SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
        SECRET_STORE_BEARER_TOKEN: token('E'),
      },
      'identity-api': {
        DATABASE_API_CONNECTION_REF: '{node_token}/database/identity-api',
        DATABASE_API_ROLE: 'zhudatuanidentityapi',
        SESSION_KEY_REF: '{node_token}/identity/session',
        IDENTITY_KEY_REF: '{node_token}/identity/index',
        KMS_ENDPOINT: 'https://127.0.0.1:8544',
        KMS_BEARER_TOKEN: token('K'),
        OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8655',
        OBJECT_STORE_BEARER_TOKEN: token('I'),
        SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
        SECRET_STORE_BEARER_TOKEN: token('S'),
      },
      'purchase-api': {
        DATABASE_API_CONNECTION_REF: '{node_token}/database/purchase-api',
        DATABASE_API_ROLE: 'zhudatuanpurchaseapi',
        QUOTE_KEY_REF: '{node_token}/purchase/checkout/quote',
        SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
        SECRET_STORE_BEARER_TOKEN: token('P'),
      },
      'catalog-jobs': {
        DATABASE_JOB_CONNECTION_REF: '{node_token}/database/catalog-jobs',
        DATABASE_JOB_ROLE: 'shopjob',
        JOB_WORKER_ID: '{node_slug}-catalog-1',
        OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8655',
        OBJECT_STORE_BEARER_TOKEN: token('J'),
        SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
        SECRET_STORE_BEARER_TOKEN: token('Q'),
      },
      'object-store': {
        LOCAL_TLS_KEY_FILE: '/opt/zhudatuan/shared/tls/internal.key',
        LOCAL_TLS_CERT_FILE: '/opt/zhudatuan/shared/tls/internal.crt',
        LOCAL_SECRETS_FILE: '/opt/zhudatuan/shared/secrets.json',
        LOCAL_SECRETS_PORT: '8543',
        LOCAL_KMS_PORT: '8544',
        LOCAL_KMS_MASTER_KEY: token('M'),
        LOCAL_KMS_BEARER_TOKEN: token('N'),
        LOCAL_SECRET_STORE_BEARER_TOKEN: token('R'),
        LOCAL_OBJECTS_TOKEN: token('T'),
      },
    },
    tls: {
      binding_ref: 'tls-binding:fixture',
      certificate_file: join(tlsRoot, 'origin.crt'),
      private_key_file: join(tlsRoot, 'origin.key'),
      ca_file: join(tlsRoot, 'origin-ca.crt'),
    },
    cloudflare: {
      account_id: 'account00000001',
      zone_id: 'zone00000000001',
      api_token_env: 'TEST_CLOUDFLARE_TOKEN',
    },
    identity_registry: {
      binding_ref: 'identity-registry:fixture',
      connection_string_env: 'TEST_IDENTITY_DATABASE_URL',
    },
    commands,
    health: { timeout_ms: 2_000 },
  }, null, 2)}\n`);

  const enabledUnits = new Set();
  const activeUnits = new Set();
  const publicDnsLookups = [];
  let pendingSystemDnsFailure = true;
  const runner = async (_command, args) => {
    const [action, unit] = args;
    if (action === 'is-enabled') return { code: enabledUnits.has(unit) ? 0 : 1, stdout: '', stderr: '' };
    if (action === 'enable') enabledUnits.add(unit);
    if (action === 'disable') enabledUnits.delete(unit);
    if (action === 'is-active') return { code: activeUnits.has(unit) ? 0 : 3, stdout: '', stderr: '' };
    if (action === 'start') activeUnits.add(unit);
    if (action === 'stop') activeUnits.delete(unit);
    if (args.includes('--write-out')) {
      const url = args.at(-1);
      if (url.includes('.invalid:') && url.includes('autonode-unknown-')) {
        return { code: 0, stdout: '421', stderr: '' };
      }
      if (pendingSystemDnsFailure && !args.includes('--resolve')) {
        pendingSystemDnsFailure = false;
        return { code: 6, stdout: '000', stderr: 'Could not resolve host' };
      }
      return { code: 0, stdout: '200', stderr: '' };
    }
    return { code: 0, stdout: '', stderr: '' };
  };
  const publicDnsLookup = async (hostname) => {
    publicDnsLookups.push(hostname);
    return ['203.0.113.10'];
  };
  const cloudflare = cloudflareFixture();
  const identityFacts = new Map();
  const identityRegistry = {
    async provision(fact) {
      const current = identityFacts.get(fact.activation_request_id);
      if (current && JSON.stringify(current.fact) !== JSON.stringify(fact)) throw new Error('fixture identity conflict');
      identityFacts.set(fact.activation_request_id, { fact, status: 'active' });
      return { realm_id: fact.realm.id, node_id: fact.realm.node_id, status: 'active' };
    },
    async disable(activationRequestId) {
      const current = identityFacts.get(activationRequestId);
      if (!current) throw new Error('fixture identity missing');
      current.status = 'disabled';
      return { realm_id: current.fact.realm.id, node_id: current.fact.realm.node_id, status: 'disabled' };
    },
  };
  const fetcher = async (url, init = {}) => String(url).startsWith('https://api.cloudflare.com/')
    ? await cloudflare.fetch(url, init)
    : new Response(JSON.stringify({ status: 'ready' }), { status: 200, headers: { 'content-type': 'application/json' } });
  return {
    runner,
    fetcher,
    publicDnsLookup,
    publicDnsLookups,
    cloudflare,
    activeUnits,
    identityFacts,
    identityRegistry,
  };
}

function activationRequest(root) {
  const digest = createHash('sha256').update('production-provider-artifact').digest('hex');
  return {
    schema_version: AUTONODE_ACTIVATION_REQUEST_SCHEMA_VERSION,
    activation_request_id: 'activation:provider-fixture',
    idempotency_key: 'activation-key:provider-fixture',
    provisioning_request: {
      schema_version: AUTONODE_REQUEST_SCHEMA_VERSION,
      provisioning_request_id: 'provisioning:provider-fixture',
      idempotency_key: 'provisioning-key:provider-fixture',
      created_at: '2026-09-09T04:00:00.000Z',
      line_id: 'line:zhudatuan:commerce:v1',
      parent_node_id: 'node:zhudatuan:l0',
      signed_level: 'L1',
      node_slug: 'generated-provider',
      display_name: '生成执行器节点',
      domains: {
        api: 'api.generated-provider.invalid',
        console: 'console.generated-provider.invalid',
        identity: 'accounts.generated-provider.invalid',
        storefront: 'store.generated-provider.invalid',
      },
      business: {
        scope_id: 'scope:autonode:c1',
        enterprise_id: 'organization:autonode:c1',
        code: 'C1_PROVIDER',
        public_slug: 'generated-provider',
        name: '生成执行器商城',
      },
      created_by: {
        actor_id: 'principal:autonode:c1',
        membership_id: 'membership:autonode:c1',
        authorized_operation: 'provisioning.nodes.create',
      },
      artifact: {
        source_sha: digest.slice(0, 40),
        build_id: 'autonode-c1-provider-fixture',
        build_count: 1,
        immutable_artifact_digest: `sha256:${digest}`,
        source_tree: 'clean',
        client_version: '1.8.0-c1',
      },
      resources: {
        tunnel: true,
        tls: true,
        secrets: true,
        wechat_identity: false,
        payment: false,
        callbacks: false,
      },
      binding_sources: {
        domains: {
          mode: 'OWN',
          base_domain: 'generated-provider.invalid',
          source_binding_ref: 'dns-zone:generated-provider.invalid',
        },
        wechat_identity: { mode: 'DISABLED' },
        payment: { mode: 'DISABLED' },
      },
    },
    target: {
      environment: 'staging',
      node_root: join(root, 'nodes'),
      release_directory: join(root, 'release'),
      runtime_profile_ref: join(root, 'runtime-profile.json'),
      systemd_unit_root: join(root, 'systemd'),
    },
  };
}

function cloudflareFixture() {
  const tunnels = new Map();
  const records = new Map();
  let tunnelSequence = 0;
  let recordSequence = 0;
  const response = (result, status = 200, success = true) => new Response(JSON.stringify({ success, result, errors: success ? [] : [{ message: 'not found' }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
  const fetch = async (url, init) => {
    const parsed = new URL(url);
    if (init.method === 'GET' && parsed.pathname.endsWith('/cfd_tunnel')) {
      return response([...tunnels.values()].filter(({ name }) => name === parsed.searchParams.get('name')));
    }
    if (init.method === 'POST' && parsed.pathname.endsWith('/cfd_tunnel')) {
      const body = JSON.parse(init.body);
      const sequence = String(++tunnelSequence).padStart(12, '0');
      const tunnel = { id: `11111111-1111-4111-8111-${sequence}`, name: body.name, deleted_at: null };
      tunnels.set(tunnel.id, tunnel);
      return response(tunnel);
    }
    if (init.method === 'DELETE' && parsed.pathname.includes('/cfd_tunnel/')) {
      const id = parsed.pathname.split('/').at(-1);
      return tunnels.delete(id) ? response({ id }) : response(null, 404, false);
    }
    if (init.method === 'GET' && parsed.pathname.endsWith('/dns_records')) {
      const record = records.get(parsed.searchParams.get('name'));
      return response(record ? [record] : []);
    }
    if (init.method === 'POST' && parsed.pathname.endsWith('/dns_records')) {
      const body = JSON.parse(init.body);
      const record = { id: `dnsrecord${String(++recordSequence).padStart(7, '0')}`, ...body };
      records.set(record.name, record);
      return response(record);
    }
    if (init.method === 'DELETE' && parsed.pathname.includes('/dns_records/')) {
      const id = parsed.pathname.split('/').at(-1);
      const match = [...records].find(([, record]) => record.id === id);
      if (!match) return response(null, 404, false);
      records.delete(match[0]);
      return response({ id });
    }
    throw new Error(`unexpected Cloudflare request ${init.method} ${parsed.pathname}`);
  };
  return { fetch, tunnels, records };
}
