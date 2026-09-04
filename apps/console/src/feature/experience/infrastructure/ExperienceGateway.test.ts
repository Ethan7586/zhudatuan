// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { createExperienceDocument } from '../model/ExperiencePolicy';
import { ExperienceGateway } from './ExperienceGateway';

const requests: Request[] = [];
const summary = {
  id: 'application:one',
  mallId: 'mall:one',
  code: 'ONE',
  publicSlug: 'one',
  name: '一号商城',
  status: 'active',
  version: 4,
  headSequence: 2,
  publishedSequence: 1,
  entry: { handle: 'one', url: 'http://127.0.0.1:3000/s/one', state: 'ready', releaseId: 'release:one', releaseVersion: 'version:one', contentHash: 'a'.repeat(64) },
  updatedAt: '2026-09-03T00:00:00.000Z',
} as const;
const version = {
  id: 'version:two',
  application_id: 'application:one',
  sequence: 2,
  schema_version: '2',
  configuration: createExperienceDocument('application:one', '员工福利', '欢迎选购'),
  configuration_hash: 'b'.repeat(64),
  validation_state: 'valid',
  reason: '测试',
  created_by: 'actor:one',
  created_at: '2026-09-03T00:01:00.000Z',
} as const;
const publication = { id: 'release:two', application_id: 'application:one', version_id: 'version:two', pool_id: 'pool:one', state: 'active', effective_at: '2026-09-03T00:02:00.000Z', retired_at: null, published_by: 'actor:one' } as const;
const server = setupServer(
  http.all('*/api/v1/experiences/**', ({ request }) => {
    requests.push(request.clone());
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path.endsWith('/applications')) return HttpResponse.json({ items: [summary], count: 1 });
    if (request.method === 'GET') return HttpResponse.json({ ...summary, head: version, published: version, history: [] });
    if (path.endsWith('/copies')) return HttpResponse.json({ ...summary, versionId: version.id });
    if (path.endsWith('/validation')) return HttpResponse.json({ id: version.id, application_id: summary.id, validation_state: 'valid' });
    if (path.endsWith('/publication')) return HttpResponse.json(publication);
    if (path.endsWith('/restorations') || (request.method === 'POST' && path.endsWith('/versions'))) return HttpResponse.json(version);
    return HttpResponse.json(summary);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
});
afterAll(() => server.close());

describe('ExperienceGateway', () => {
  it('maps list and detail DTOs into deeply immutable models', async () => {
    const gateway = new ExperienceGateway('http://localhost');
    const page = await gateway.applications(context());
    const detail = await gateway.application(context(), summary.id);
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items)).toBe(true);
    expect(Object.isFrozen(detail.head?.configuration.pages)).toBe(true);
  });

  it('sends stable command identity, optimistic version and Step-up proof through every write boundary', async () => {
    const gateway = new ExperienceGateway('http://localhost');
    const proof = 'p'.repeat(43);
    await gateway.create(context(), { code: 'TWO', publicSlug: 'two', name: '二号商城' }, 'command:create');
    await gateway.copy(context(), summary.id, { code: 'THREE', publicSlug: 'three', name: '三号商城' }, '复制商城', 'command:copy');
    await gateway.update(context(), summary.id, 4, { name: '一号商城', status: 'disabled' }, 'command:update');
    await gateway.saveVersion(context(), { application: summary.id, configuration: version.configuration, reason: '保存装修' }, 'command:save');
    await gateway.validateVersion(context(), version.id, 'command:validate');
    await gateway.publishVersion(context(), version.id, 4, proof, 'command:publish');
    await gateway.restoreVersion(context(), version.id, '恢复装修', proof, 'command:restore');
    expect(requests.map((request) => request.headers.get('idempotency-key'))).toEqual(['command:create', 'command:copy', 'command:update', 'command:save', 'command:validate', 'command:publish', 'command:restore']);
    expect(requests[2]?.headers.get('if-match')).toBe('"4"');
    expect(requests[5]?.headers.get('if-match')).toBe('"4"');
    expect(requests[5]?.headers.get('x-action-proof')).toBe(proof);
    expect(requests[6]?.headers.get('x-action-proof')).toBe(proof);
    expect(requests.every((request) => request.headers.get('x-scope-hint') === 'enterprise:one' && request.headers.get('x-access-version') === '7')).toBe(true);
  });
});

function context(): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id: 'enterprise:one' };
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:one',
      accessVersion: 7,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 3 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      csrf: 'csrf:one',
      syncedAt: '2026-09-03T00:00:00.000Z',
    },
    profile: { display_name: '测试', employee_no: null },
    scope,
    scopes: [scope],
  };
}
