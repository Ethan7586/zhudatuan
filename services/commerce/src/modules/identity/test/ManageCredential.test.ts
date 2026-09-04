import { describe, expect, it, vi } from 'vitest';
import { ManageCredential } from '../application/service/ManageCredential';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';

describe('ManageCredential mobile verification', () => {
  it('applies destination, network and device verification limits before consuming the OTP', async () => {
    const throttle = vi.fn();
    const consume = vi.fn(async () => ({ principal_id: 'principal:one' }));
    const credentials = { changeSubject: vi.fn() };
    const members = { changeMobile: vi.fn(async () => ({ id: 'member:one', display_name: '张三', mobile_masked: '138****8000', version: 3 })) };
    const assurances = { expire: vi.fn(), record: vi.fn() };
    const command = new ManageCredential(
      {} as never,
      { throttle, consume } as never,
      members as never,
      { encrypt: vi.fn(async () => ({ ciphertext: 'encrypted-mobile', fingerprint: 'f'.repeat(64), keyVersion: 'current' })) } as never,
      {} as never,
      'identity-key-with-at-least-thirty-two-bytes',
      'session-key-with-at-least-thirty-two-bytes',
      credentials as never,
      assurances as never,
      {} as never,
      {} as never
    );
    const lifecycle = command.mobile();
    const request = mobileRequest();
    const prepared = await lifecycle.prepare!(request, undefined);
    await withWriteTransaction(async () => result([]), (context) => lifecycle.execute(request, context, prepared));

    const buckets = throttle.mock.calls[0]![1] as readonly (readonly [string, string])[];
    expect(buckets.map(([, bucket]) => bucket)).toEqual(['verify:phone_change', 'network:verify:phone_change', 'device:verify:phone_change']);
    expect(throttle.mock.invocationCallOrder[0]).toBeLessThan(consume.mock.invocationCallOrder[0]!);
    expect(consume).toHaveBeenCalledWith(expect.anything(), 'challenge:one', '123456', expect.any(Function), 'principal:one', expect.objectContaining({ purpose: 'phone_change' }));
  });
});

function mobileRequest() {
  return {
    type: 'identity.mobile.manage',
    input: {
      path: {}, query: {},
      headers: { 'x-peer-address': '203.0.113.8', 'x-device-id': 'device:one' },
      body: { mobile: '13800138000', challenge: 'challenge:one', code: '123456' },
      rawBody: '', deadline: Date.now() + 10_000, signal: new AbortController().signal, idempotency: 'mobile-change', expectedVersion: undefined,
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 2 } },
        membership: { id: 'membership:one', permissions: { allows: new Set(['identity.credential.manage']), denies: new Set() }, scopes: [], active: true, accessVersion: 1 },
        roles: [], organization: 'mall:one', scope: { kind: 'self', id: 'self:one', path: [] }, capabilities: new Set(['identity.mobile.manage']), capabilityVersion: 1, accessVersion: 1, assurance: { level: 2 }, trace: 'trace:mobile',
      },
    },
  } as never;
}
