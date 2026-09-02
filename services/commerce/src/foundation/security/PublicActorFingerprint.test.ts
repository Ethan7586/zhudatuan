import { describe, expect, it } from 'vitest';
import { OperationCatalog } from '@shop/contract';
import { PublicActorFingerprint } from './PublicActorFingerprint';

const fingerprint = new PublicActorFingerprint('public-actor-test-key-material-at-least-thirty-two-bytes');
const operation = OperationCatalog.get('identity.invitations.resolve');

describe('PublicActorFingerprint', () => {
  it('is stable across equivalent IPv4 and mapped IPv6 peers', () => {
    const input = { body: { code: 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ12', target: 'storefront' } };
    const headers = { 'x-client-target': 'storefront', 'x-device-id': 'device:one', 'x-peer-address': '203.0.113.47' };
    expect(fingerprint.create(operation, input, headers)).toBe(fingerprint.create(operation, input, { ...headers, 'x-peer-address': '::ffff:203.0.113.99' }));
  });

  it('isolates target, device, network prefix and credential without exposing them', () => {
    const actor = fingerprint.create(
      operation,
      { body: { code: 'private-invitation-code', target: 'storefront' } },
      { 'x-client-target': 'storefront', 'x-device-id': 'private-device', 'x-peer-address': '2001:db8:1:2::10' }
    );
    expect(actor).toMatch(/^public:[0-9a-f]{64}$/);
    for (const secret of ['private-invitation-code', 'private-device', '2001:db8']) expect(actor).not.toContain(secret);
    expect(actor).not.toBe(
      fingerprint.create(operation, { body: { code: 'other-code', target: 'storefront' } }, { 'x-client-target': 'storefront', 'x-device-id': 'private-device', 'x-peer-address': '2001:db8:1:2::10' })
    );
  });

  it('rejects weak server keys', () => {
    expect(() => new PublicActorFingerprint('weak')).toThrow('PUBLIC_ACTOR_KEY_INVALID');
  });
});
