import { describe, expect, it, vi } from 'vitest';
import { OperationCatalog } from '@shop/contract';
import type { AccessContext } from '../platform/security/AccessContext';
import { SecureOperationPolicy } from './OperationPolicy';

const accessContext = {
  actor: { id: 'principal:1', session: 'session:1', membership: 'membership:1', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
  membership: { id: 'membership:1', active: true, accessVersion: 1, permissions: { allows: new Set(['member.profile.read']), denies: new Set() }, scopes: [] },
  roles: [],
  organization: 'mall:1',
  scope: { kind: 'self', id: 'member:1', path: [] },
  accessVersion: 1,
  capabilities: new Set(['member.profile.read']),
  capabilityVersion: 1,
  assurance: { level: 1 },
  trace: 'trace:1',
} as const satisfies AccessContext;

function fixture() {
  const access = { authorize: vi.fn(async () => Object.freeze({ access: accessContext, decision: Promise.resolve() })) };
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
        authorization: null,
        returnTarget: null,
      })
    ),
  };
  const risk = { evaluate: vi.fn(async () => ({ outcome: 'allow' as const, safeReason: 'policy' as const, decision: null })) };
  const append: (_decision: unknown) => Promise<void> = async () => undefined;
  const decisions = { append: vi.fn(append) };
  return { policy: new SecureOperationPolicy(access as never, preauth, risk, decisions), access, preauth, risk, decisions };
}

describe('SecureOperationPolicy security states', () => {
  it('returns an explicit anonymous context and evaluates public risk', async () => {
    const value = fixture();
    await expect(value.policy.authorize({ operation: OperationCatalog.get('identity.sessions.create'), input: {}, headers: { 'x-client-target': 'storefront', 'x-trace-id': 'trace:anonymous' }, ...execution() })).resolves.toMatchObject({
      security: { kind: 'anonymous', target: 'storefront' },
      decision: expect.any(Promise),
    });
    expect(value.risk.evaluate).toHaveBeenCalledOnce();
    expect(value.access.authorize).not.toHaveBeenCalled();
  });

  it('returns an allowed public context while its durable decision is still pending', async () => {
    const value = fixture();
    let finishDecision: (() => void) | undefined;
    value.decisions.append.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDecision = resolve;
        })
    );

    const authorization = await value.policy.authorize({ operation: OperationCatalog.get('identity.bootstrap.read'), input: {}, headers: { 'x-client-target': 'storefront' }, ...execution() });
    let settled = false;
    void authorization.decision.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishDecision?.();
    await expect(authorization.decision).resolves.toBeUndefined();
  });

  it('resolves and preserves the purpose-bound preauth context', async () => {
    const value = fixture();
    await expect(value.policy.authorize({ operation: OperationCatalog.get('identity.federations.selection.read'), input: {}, headers: { 'x-client-target': 'storefront' }, ...execution() })).resolves.toMatchObject({
      security: { kind: 'preauth', purpose: 'federationselection' },
      decision: expect.any(Promise),
    });
    expect(value.preauth.resolve).toHaveBeenCalledOnce();
    expect(value.access.authorize).not.toHaveBeenCalled();
  });

  it('wraps authenticated access in the session context', async () => {
    const value = fixture();
    await expect(value.policy.authorize({ operation: OperationCatalog.get('member.profile.read'), input: {}, headers: {}, ...execution() })).resolves.toMatchObject({
      security: { kind: 'session', access: accessContext },
      decision: expect.any(Promise),
    });
    expect(value.access.authorize).toHaveBeenCalledOnce();
    expect(value.preauth.resolve).not.toHaveBeenCalled();
  });
});

function execution() {
  return { deadline: Date.now() + 10_000, signal: new AbortController().signal };
}
