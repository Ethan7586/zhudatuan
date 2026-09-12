import type { MembershipAccess, Scope } from '@shop/authz';
import type { OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { AccessPipeline } from './AccessPipeline';
import type { Actor } from '../platform/security/AccessContext';

const NOW = new Date('2026-08-27T00:00:00.000Z');
const PLATFORM: Scope = Object.freeze({ kind: 'platform', id: 'platform:one', path: [] });
const OWNER: Scope = Object.freeze({ kind: 'owner', id: 'member:one', path: [] });

describe('AccessPipeline audience boundary', () => {
  it('denies a console operation before membership resolution for a storefront session', async () => {
    const target = 'storefront' as const;
    const fixture = accessFixture(target, 'access.center.read', 'access.center.read', PLATFORM);
    await expect(fixture.pipeline.authorize({}, 'access.center.read', 'access.center.read', Date.now() + 10_000, new AbortController().signal)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      details: { reason: 'AUDIENCE_TARGET_MISMATCH', audience: 'console', target },
    });
    expect(fixture.authorization).toHaveBeenCalledOnce();
    expect(fixture.decisions).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'access.center.read',
        outcome: 'deny',
        reason: 'PERMISSION_DENIED',
      })
    );
  });

  it('allows an operator operation for a console session', async () => {
    const fixture = accessFixture('console', 'access.center.read', 'access.center.read', PLATFORM);

    await expect(fixture.pipeline.authorize({}, 'access.center.read', 'access.center.read', Date.now() + 10_000, new AbortController().signal)).resolves.toMatchObject({
      access: { actor: { target: 'console' }, scope: PLATFORM },
      decision: expect.any(Promise),
    });
    expect(fixture.decisions).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'allow', reason: 'POLICY_ALLOWED' }));
  });

  it('keeps storefront member operations authorized through the normal policy pipeline', async () => {
    const fixture = accessFixture('storefront', 'member.profile.read', 'member.profile.read', OWNER);

    await expect(fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read', Date.now() + 10_000, new AbortController().signal)).resolves.toMatchObject({
      access: { actor: { target: 'storefront' }, scope: OWNER },
      decision: expect.any(Promise),
    });
    expect(fixture.authorization).toHaveBeenCalledWith({}, 'member.profile.read', expect.objectContaining({ deadline: expect.any(Number), signal: expect.any(AbortSignal) }));
    expect(fixture.risk).toHaveBeenCalledWith(expect.objectContaining({ operation: 'member.profile.read' }));
  });

  it('returns an allowed read authorization while its durable decision is still pending', async () => {
    let finishDecision: (() => void) | undefined;
    const fixture = accessFixture(
      'storefront',
      'member.profile.read',
      'member.profile.read',
      OWNER,
      'allow',
      1,
      () =>
        new Promise<void>((resolve) => {
          finishDecision = resolve;
        })
    );

    const authorization = await fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read', Date.now() + 10_000, new AbortController().signal);
    let settled = false;
    void authorization.decision.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishDecision?.();
    await expect(authorization.decision).resolves.toBeUndefined();
  });

  it('preserves the authoritative risk reason for immediate session invalidation', async () => {
    const fixture = accessFixture('storefront', 'member.profile.read', 'member.profile.read', OWNER, 'deny');

    await expect(fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read', Date.now() + 10_000, new AbortController().signal)).rejects.toMatchObject({
      code: 'AUTHORIZATION_DENIED',
      details: { reason: 'RISK_DENIED' },
    });
    expect(fixture.decisions).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ id: 'actor:one' }),
        outcome: 'deny',
        reason: 'RISK_DENIED',
      })
    );
  });

  it('rejects a session when the canonical credential version changed', async () => {
    const fixture = accessFixture('console', 'access.center.read', 'access.center.read', PLATFORM, 'allow', 2);
    await expect(fixture.pipeline.authorize({}, 'access.center.read', 'access.center.read', Date.now() + 10_000, new AbortController().signal)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      details: { reason: 'CREDENTIAL_VERSION_STALE' },
    });
  });
});

function accessFixture(target: Actor['target'], operation: OperationId, permission: string, scope: Scope, riskOutcome: 'allow' | 'deny' = 'allow', credentialVersion = 1, append: () => Promise<void> = async () => undefined) {
  const privileged = operation === 'access.center.read';
  const actor: Actor = Object.freeze({ id: 'actor:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target, assurance: privileged ? { level: 3, verified: NOW } : { level: 1 } });
  const membershipAccess: MembershipAccess = Object.freeze({
    id: actor.membership,
    active: true,
    accessVersion: actor.accessVersion,
    permissions: Object.freeze({ allows: new Set([permission]), denies: new Set<string>() }),
    scopes: [{ effect: 'allow' as const, scope, effective: '2026-08-26T00:00:00.000Z', expires: null }],
  });
  const snapshot = Object.freeze({ membership: membershipAccess, scope, capabilities: new Set([operation]), capabilityVersion: 1, credentialVersion, organization: 'organization:one', target, roles: Object.freeze([]) });
  const authorization = vi.fn(async () => Object.freeze({ actor, snapshot }));
  const risk = vi.fn(async () => ({ outcome: riskOutcome, safeReason: riskOutcome === 'allow' ? 'policy' : 'signal', decision: null }) as const);
  const decisions = vi.fn(append);
  const pipeline = new AccessPipeline({ resolve: authorization }, { now: () => NOW }, { evaluate: risk }, { append: decisions });
  return { pipeline, authorization, risk, decisions };
}
