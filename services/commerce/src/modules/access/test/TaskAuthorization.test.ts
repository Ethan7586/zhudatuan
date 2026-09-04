import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationSnapshotRecord } from '../application/port/AuthorizationRepository';
import { TaskAuthorization } from '../application/service/TaskAuthorization';
import { result, withReadTransaction } from '../../../test/TransactionFixture';

const operation = 'voucher.searchexports.create';
const evidence = { actor: 'actor:test', membership: 'membership:test', organization: 'organization:test', scope: 'scope:test', target: 'console',
  operation, accessVersion: 2, credentialVersion: 3, capabilityVersion: 4, capturedAt: new Date().toISOString() };
const scope = { id: 'scope:test', kind: 'mall' as const, path: [] };

function current(patch: Partial<AuthorizationSnapshotRecord> = {}): AuthorizationSnapshotRecord {
  return { membership: 'membership:test', active: true, organization: 'organization:test', target: 'console', roles: [],
    accessVersion: 2, credentialVersion: 3, capabilityVersion: 4, resource: scope,
    allows: ['voucher.export.manage'], denies: [], operations: [operation],
    scopes: [{ effect: 'allow', scope, effective: '2020-01-01T00:00:00Z', expires: null }], ...patch };
}
const query = async () => result([]);

describe('deferred task authorization', () => {
  it('rereads current account, membership, permissions, scopes and entitlements on every check', async () => {
    const snapshot = vi.fn(async () => current());
    const service = new TaskAuthorization({ snapshot });
    for (let page = 0; page < 2; page++) await withReadTransaction(query, context => service.assert(context, evidence));
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(snapshot).toHaveBeenCalledWith(expect.anything(), { membership: evidence.membership, target: 'console', operation, resource: scope.id });
  });

  it.each([
    ['inactive principal or membership', { active: false }],
    ['revoked permission', { allows: [] }],
    ['explicit deny overrides allow', { denies: ['voucher.export.manage'] }],
    ['removed capability', { operations: [] }],
    ['changed credential', { credentialVersion: 4 }],
    ['changed membership grants', { accessVersion: 3 }],
    ['changed capability grants', { capabilityVersion: 5 }],
    ['changed organization', { organization: 'organization:other' }],
    ['changed target', { target: 'supplier' }],
    ['different membership', { membership: 'membership:other' }],
    ['different resource', { resource: { ...scope, id: 'scope:other' } }],
    ['missing scope grant', { scopes: [] }],
    ['expired scope grant', { scopes: [{ effect: 'allow', scope, effective: '2020-01-01T00:00:00Z', expires: '2021-01-01T00:00:00Z' }] }],
    ['explicit scope deny', { scopes: [{ effect: 'deny', scope, effective: '2020-01-01T00:00:00Z', expires: null }] }],
  ] satisfies readonly (readonly [string, Partial<AuthorizationSnapshotRecord>])[])('rejects %s', async (_name, patch) => {
    const service = new TaskAuthorization({ snapshot: async () => current(patch) });
    await expect(withReadTransaction(query, context => service.assert(context, evidence))).rejects.toThrow('AUTHORIZATION_DENIED');
  });

  it('rejects a deleted account', async () => {
    await expect(withReadTransaction(query, context => new TaskAuthorization({ snapshot: async () => null }).assert(context, evidence))).rejects.toThrow('AUTHORIZATION_DENIED');
  });

  it.each([
    { membership: undefined }, { actor: '' }, { scope: 'scope:other' }, { target: 'auth' },
    { operation: 'invalid.operation' }, { operation: 'runtime.health.live' }, { credentialVersion: 0 },
    { capabilityVersion: Infinity }, { capturedAt: 'invalid' }, { capturedAt: '9999-01-01T00:00:00Z' },
  ])('rejects invalid or cross-scope evidence before a database read: %j', async patch => {
    const snapshot = vi.fn(async () => current());
    await expect(withReadTransaction(query, context => new TaskAuthorization({ snapshot }).assert(context, { ...evidence, ...patch }))).rejects.toThrow('AUTHORIZATION_DENIED');
    expect(snapshot).not.toHaveBeenCalled();
  });
});
