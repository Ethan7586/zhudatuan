import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { ErrorContractSchema } from '@shop/contract';

const repository = new URL('../..', import.meta.url);
let previewProcess: ReturnType<typeof spawn> | undefined;
let origin = '';

before(async () => {
  const port = await availablePort();
  origin = `http://127.0.0.1:${port}`;
  previewProcess = spawn(process.execPath, ['--import', 'tsx', 'tests/browser/ConsolePreviewServer.mjs'], {
    cwd: repository,
    env: { ...process.env, CONSOLE_PREVIEW_API_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitUntilReady(origin);
});

after(async () => {
  if (previewProcess === undefined || previewProcess.exitCode !== null) return;
  previewProcess.kill('SIGTERM');
  await once(previewProcess, 'exit');
});

test('preview session grants only the permission and capability pairs backed by fixtures', async () => {
  const response = await fetch(`${origin}/api/v1/identity/session`);
  assert.equal(response.status, 200);
  const session = await response.json() as { readonly permissions: readonly string[]; readonly capabilities: readonly string[] };

  const supported = [
    ['identity.session.read', 'identity.session.read'],
    ['member.profile.read', 'member.profile.read'],
    ['reporting.dashboard.read', 'reporting.dashboard.read'],
    ['runtime.health.dependency', 'runtime.health.read'],
    ['catalog.listings.read', 'catalog.listing.read'],
    ['order.orders.read', 'order.read'],
    ['finance.overview.read', 'finance.overview.read'],
    ['finance.reconciliations.read', 'finance.reconciliation.read'],
    ['experience.applications.read', 'experience.application.read'],
    ['voucher.cardlibraries.read', 'voucher.cardlibrary.read'],
    ['voucher.programs.read', 'voucher.program.read'],
    ['voucher.reserves.read', 'voucher.reserve.read'],
    ['voucher.batches.read', 'voucher.batch.read'],
    ['referral.settings.read', 'referral.settings.read'],
    ['referral.products.read', 'referral.products.read'],
    ['referral.members.read', 'referral.members.read'],
    ['referral.bindings.read', 'referral.bindings.read'],
    ['referral.commissions.read', 'referral.commissions.read'],
  ] as const;
  for (const [capability, permission] of supported) {
    assert.ok(session.capabilities.includes(capability), `missing capability ${capability}`);
    assert.ok(session.permissions.includes(permission), `missing permission ${permission}`);
  }

  for (const capability of ['channel.connections.read', 'channel.syncruns.read', 'channel.operations.read',
    'access.center.read', 'qualification.center.read']) {
    assert.ok(!session.capabilities.includes(capability), `unexpected capability ${capability}`);
  }
  for (const permission of ['channel.connection.read', 'channel.sync.read', 'channel.operation.read',
    'access.center.read', 'qualification.read']) {
    assert.ok(!session.permissions.includes(permission), `unexpected permission ${permission}`);
  }
});

test('unsupported reads remain closed with a strict ErrorContract', async () => {
  const paths = ['/api/v1/channels/connections', '/api/v1/access/center', '/api/v1/qualifications'];
  for (const [index, path] of paths.entries()) {
    const requestId = `preview-denied-${index}`;
    const response = await fetch(`${origin}${path}`, { headers: { 'x-trace-id': requestId } });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'PREVIEW_OPERATION_FORBIDDEN',
      message: '当前预览账号尚未开通此页面。',
      requestId,
      retryable: false,
    });
    assert.equal(ErrorContractSchema.safeParse(body).success, true);
  }
});

test('display-only writes return a strict non-retryable ErrorContract', async () => {
  const response = await fetch(`${origin}/api/v1/referral/settings`, {
    method: 'POST',
    headers: { 'x-trace-id': 'preview-write-denied' },
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(body, {
    code: 'DISPLAY_ONLY',
    message: '分销展示环境禁止写入。',
    requestId: 'preview-write-denied',
    retryable: false,
  });
  assert.equal(ErrorContractSchema.safeParse(body).success, true);
});

async function availablePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  return address.port;
}

async function waitUntilReady(target: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (previewProcess?.exitCode !== null) throw new Error(`CONSOLE_PREVIEW_SERVER_EXITED_${previewProcess?.exitCode ?? 'UNKNOWN'}`);
    try {
      const response = await fetch(`${target}/api/v1/identity/session`);
      if (response.ok) return;
    } catch {
      // The child has not bound its socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('CONSOLE_PREVIEW_SERVER_READY_TIMEOUT');
}
