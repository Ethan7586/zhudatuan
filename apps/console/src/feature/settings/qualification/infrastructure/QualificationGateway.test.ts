// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { QualificationGateway } from './QualificationGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('QualificationGateway', () => {
  it('maps policies and bounded immutable version history', async () => {
    server.use(http.get('https://shop.test/api/v1/qualifications', () => HttpResponse.json({ items: [policy], cases: [], count: 1 })));
    const page = await new QualificationGateway('https://shop.test').read(context);
    expect(page.items[0]).toMatchObject({ id: 'policy:one', activeVersion: 3, ruleHash: 'a'.repeat(64), versions: [{ version: 3 }] });
    expect(Object.isFrozen(page.items[0]?.versions)).toBe(true);
  });

  it('sends an exact preview command with csrf and stable identity', async () => {
    server.use(
      http.post('https://shop.test/api/v1/qualifications/decisions/preview', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBeNull();
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(await request.json()).toEqual({ kind: 'publish', policy: 'policy:one', name: '员工策略', rule: { effect: 'deny' } });
        return HttpResponse.json({ kind: 'policy', impact });
      })
    );
    await expect(new QualificationGateway('https://shop.test').previewPolicy(context, { kind: 'publish', policy: 'policy:one', name: '员工策略', rule: { effect: 'deny' } })).resolves.toMatchObject({
      nextVersion: 4,
      changedFields: ['effect'],
    });
  });

  it('binds proof, expected version and identity to rollback', async () => {
    const proof = 'p'.repeat(43);
    server.use(
      http.put('https://shop.test/api/v1/qualifications/policies/policy%3Aone', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"3"');
        expect(request.headers.get('x-action-proof')).toBe(proof);
        expect(request.headers.get('idempotency-key')).toBe('identity:manage');
        expect(await request.json()).toEqual({ action: 'rollback', version: 1 });
        return HttpResponse.json({
          id: 'policy:one',
          scope_id: 'mall:one',
          name: '员工策略',
          status: 'published',
          active_version: 4,
          created_at: '2026-09-03T00:00:00.000Z',
          updated_at: '2026-09-03T00:01:00.000Z',
          rule_hash: 'b'.repeat(64),
          action: 'rollback',
          source_version: 1,
        });
      })
    );
    await expect(new QualificationGateway('https://shop.test').manage(context, { action: 'rollback', policy: 'policy:one', version: 1, expectedVersion: 3, proof, identity: 'identity:manage' })).resolves.toMatchObject({
      activeVersion: 4,
      sourceVersion: 1,
    });
  });
});

const policy = {
  id: 'policy:one',
  name: '员工策略',
  status: 'published',
  active_version: 3,
  updated_at: '2026-09-03T00:01:00.000Z',
  rule: { effect: 'allow' },
  rule_hash: 'a'.repeat(64),
  published_at: '2026-09-03T00:01:00.000Z',
  versions: [{ version: 3, rule_hash: 'a'.repeat(64), published_at: '2026-09-03T00:01:00.000Z', created_by: 'membership:one' }],
};
const impact = {
  action: 'publish',
  policy_id: 'policy:one',
  current_version: 3,
  next_version: 4,
  source_version: null,
  current_hash: 'a'.repeat(64),
  proposed_hash: 'b'.repeat(64),
  changed_fields: ['effect'],
  potential_profiles: 100,
  resource_count: 2,
  subject_count: 1,
  limit_count: 1,
};
const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['qualification.read', 'qualification.preview', 'qualification.manage'],
    capabilities: ['qualification.center.read', 'qualification.decisions.preview', 'qualification.policies.manage'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};
