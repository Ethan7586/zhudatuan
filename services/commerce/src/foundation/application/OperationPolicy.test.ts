import { describe, expect, it, vi } from 'vitest';
import { OperationCatalog } from '@shop/contract';
import type { AccessContext } from '../security/AccessContext';
import { SecureOperationPolicy } from './OperationPolicy';

const accessContext = {
  actor: { id: 'principal:1', session: 'session:1', membership: 'membership:1', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
  membership: { id: 'membership:1', active: true, accessVersion: 1, permissions: { allows: new Set(['member.profile.read']), denies: new Set() }, scopes: [] },
  organization: 'mall:1',
  scope: { kind: 'self', id: 'member:1', path: [] },
  accessVersion: 1,
  capabilities: new Set(['member.profile.read']),
  capabilityVersion: 1,
  assurance: { level: 1 },
  trace: 'trace:1',
} as const satisfies AccessContext;

function fixture() {
  const access = { authorize: vi.fn(async () => accessContext) };
  const preauth = {
    resolve: vi.fn(async () =>
      Object.freeze({
        kind: 'preauth' as const,
        id: 'preauth:1',
        purpose: 'federationselection' as const,
        target: 'storefront' as const,
        principal: 'principal:1',
        reference: 'transaction:1',
        version: 0,
        expires: new Date('2026-08-30T01:00:00Z'),
        trace: 'trace:preauth',
      })
    ),
  };
  const risk = { evaluate: vi.fn(async () => ({ outcome: 'allow' as const, safeReason: 'policy' as const, decision: null })) };
  const decisions = { append: vi.fn(async () => undefined) };
  return { policy: new SecureOperationPolicy(access as never, preauth, risk, decisions), access, preauth, risk, decisions };
}

describe('SecureOperationPolicy security states', () => {
  it('returns an explicit anonymous context and evaluates public risk', async () => {
    const value = fixture();
    await expect(value.policy.authorize({ operation: OperationCatalog.get('identity.sessions.create'), input: {}, headers: { 'x-client-target': 'storefront', 'x-trace-id': 'trace:anonymous' } })).resolves.toMatchObject({
      kind: 'anonymous',
      target: 'storefront',
    });
    expect(value.risk.evaluate).toHaveBeenCalledOnce();
    expect(value.access.authorize).not.toHaveBeenCalled();
  });

  it('resolves and preserves the purpose-bound preauth context', async () => {
    const value = fixture();
    await expect(value.policy.authorize({ operation: OperationCatalog.get('identity.federations.selection.read'), input: {}, headers: { 'x-client-target': 'storefront' } })).resolves.toMatchObject({
      kind: 'preauth',
      purpose: 'federationselection',
    });
    expect(value.preauth.resolve).toHaveBeenCalledOnce();
    expect(value.access.authorize).not.toHaveBeenCalled();
  });

  it('wraps authenticated access in the session context', async () => {
    const value = fixture();
    await expect(value.policy.authorize({ operation: OperationCatalog.get('member.profile.read'), input: {}, headers: {} })).resolves.toEqual({ kind: 'session', access: accessContext });
    expect(value.access.authorize).toHaveBeenCalledOnce();
    expect(value.preauth.resolve).not.toHaveBeenCalled();
  });
});
