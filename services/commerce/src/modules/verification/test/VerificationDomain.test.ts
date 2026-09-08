import { describe, expect, it } from 'vitest';
import { Challenge } from '../domain/model/Challenge';
import { TrustedDevice } from '../domain/model/TrustedDevice';
import { VerificationSession } from '../domain/model/VerificationSession';
import { RatePolicy } from '../domain/policy/RatePolicy';
import { VerificationPolicy } from '../domain/policy/VerificationPolicy';

const NOW = new Date('2026-09-05T00:00:00.000Z');

describe('verification domain', () => {
  it('keeps a challenge short lived and one time', () => {
    const challenge = Challenge.issue({ session: 'verification:one', tokenHash: 'a'.repeat(64), issuedAt: NOW, expiresAt: new Date(NOW.getTime() + 60_000) });
    const consumed = challenge.consume(new Date(NOW.getTime() + 1_000));
    expect(consumed.snapshot().consumedAt).toEqual(new Date(NOW.getTime() + 1_000));
    expect(() => consumed.consume(new Date(NOW.getTime() + 2_000))).toThrow('VERIFICATION_TOKEN_INVALID');
  });

  it('rejects a token exactly at the expiry boundary so clock skew cannot extend it', () => {
    const expiresAt = new Date(NOW.getTime() + 60_000);
    const challenge = Challenge.issue({ session: 'verification:clock', tokenHash: 'd'.repeat(64), issuedAt: NOW, expiresAt });
    expect(() => challenge.consume(expiresAt)).toThrow('VERIFICATION_TOKEN_INVALID');
  });

  it('locks a session after the configured attempt limit', () => {
    let session = VerificationSession.issue({
      id: 'verification:one',
      scope: 'mall:one',
      subjectType: 'member',
      subject: 'member:one',
      purpose: 'member_code',
      operation: 'verification.member.inspect',
      channel: 'qrcode',
      maximumAttempts: 3,
      issuedBy: 'membership:one',
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
    session = session.reject(new Date(NOW.getTime() + 1_000));
    session = session.reject(new Date(NOW.getTime() + 2_000));
    session = session.reject(new Date(NOW.getTime() + 3_000));
    expect(session.snapshot()).toMatchObject({ state: 'locked', attempts: 3, version: 3 });
    expect(() => session.verify(new Date(NOW.getTime() + 4_000))).toThrow('VERIFICATION_TOKEN_INVALID');
  });

  it('binds every proof policy to one purpose and operation', () => {
    const policy = new VerificationPolicy();
    expect(policy.resolve('financial_approval')).toMatchObject({ operation: 'finance.approvals.decide', channel: 'app', minimumAssurance: 3 });
    expect(() => policy.resolve('financial_approval', 'voucher.redemptions.create')).toThrow('CHALLENGE_PURPOSE_INVALID');
  });

  it('rate limits both challenge delivery and verification attempts', () => {
    const rate = new RatePolicy(2, 10);
    expect(() => rate.issue({ count: 2, lastIssuedAt: null, now: NOW })).toThrow('RATE_LIMITED');
    expect(() => rate.issue({ count: 0, lastIssuedAt: new Date(NOW.getTime() - 5_000), now: NOW })).toThrow('RATE_LIMITED');
    expect(() => rate.verify(3, 3)).toThrow('RATE_LIMITED');
  });

  it('never allows a retired device to be silently re-trusted', () => {
    const retired = new TrustedDevice({ id: 'device:one', scope: 'store:one', label: '收银台一号', fingerprintHash: 'b'.repeat(64), publicKey: null, state: 'retired', version: 2 });
    expect(() => retired.revise({ label: '新名称', fingerprintHash: 'c'.repeat(64), publicKey: null, state: 'trusted' }, 2)).toThrow('VERSION_CONFLICT');
  });
});
