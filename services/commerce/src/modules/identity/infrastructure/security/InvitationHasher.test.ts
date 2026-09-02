import { describe, expect, it } from 'vitest';
import { InvitationCode } from '../../domain/model/InvitationCode';
import { InvitationHasher } from './InvitationHasher';

const v1 = { version: 'v1', value: 'invitation-key-version-one-value-00000001' };
const v2 = { version: 'v2', value: 'invitation-key-version-two-value-00000002' };
const v3 = { version: 'v3', value: 'invitation-key-version-three-value-00000003' };
const code = InvitationCode.issue(Buffer.alloc(24, 9));

describe('InvitationHasher key rotation', () => {
  it('keeps token and recipient verification valid during the bounded previous-key window', () => {
    const original = new InvitationHasher(JSON.stringify({ current: v1, previous: [] }));
    const token = original.current(code);
    const recipient = original.recipient('+852 9123 4567');
    const rotated = new InvitationHasher(JSON.stringify({ current: v2, previous: [v1] }));
    expect(rotated.candidates(code)).toHaveLength(2);
    expect(rotated.matches(code, token.hash, token.version)).toBe(true);
    expect(rotated.matchesRecipient('+852 9123 4567', recipient)).toBe(true);
    expect(rotated.versions()).toEqual(['v2', 'v1']);
  });

  it('retires an old key only after it leaves the active ring', () => {
    const original = new InvitationHasher(JSON.stringify({ current: v1, previous: [] }));
    const token = original.current(code);
    const retired = new InvitationHasher(JSON.stringify({ current: v3, previous: [v2] }));
    expect(retired.matches(code, token.hash, token.version)).toBe(false);
    expect(retired.matchesRecipient('member@example.com', original.recipient('member@example.com'))).toBe(false);
  });

  it('enforces unique immutable versions, strong material and at most three candidates', () => {
    expect(new InvitationHasher(JSON.stringify({ current: v3, previous: [v2, v1] })).candidates(code)).toHaveLength(3);
    expect(() => new InvitationHasher(JSON.stringify({ current: v3, previous: [v2, v1, { version: 'v0', value: v1.value }] }))).toThrow('INVITATION_KEYRING_INVALID');
    expect(() => new InvitationHasher(JSON.stringify({ current: v2, previous: [v2] }))).toThrow('INVITATION_KEYRING_INVALID');
    expect(() => new InvitationHasher(JSON.stringify({ current: { version: 'weak', value: 'short' }, previous: [] }))).toThrow('INVITATION_KEYRING_INVALID');
  });
});
