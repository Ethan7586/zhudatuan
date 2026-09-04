import { describe, expect, it, vi } from 'vitest';
import { ChallengesIssueHandler } from '../application/handler/ChallengesIssueHandler';
import { ChallengesVerifyHandler } from '../application/handler/ChallengesVerifyHandler';

describe('verification handler secret safety', () => {
  it('returns only a short-lived QR token and persists only its hash', async () => {
    const issue = vi.fn(async (_context, input) => ({ id: input.id, subject_type: 'member', subject_id: 'member:one', purpose: input.purpose,
      operation_id: 'verification.member.inspect', channel: 'qrcode', state: 'issued', attempts: 0, maximum_attempts: 5,
      expires_at: new Date('2026-09-05T00:01:00.000Z'), verified_at: null, version: 0 }));
    const response = await new ChallengesIssueHandler({ issue, verify: vi.fn() }).execute({ body: { purpose: 'member_code' } } as never, context() as never);
    expect(response.body).toHaveProperty('token', expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
    expect(response.body).not.toHaveProperty('nonce');
    expect(response.body).not.toHaveProperty('code');
    expect(issue.mock.calls[0]?.[1]).toMatchObject({ tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(issue.mock.calls[0]?.[1].tokenHash).not.toBe((response.body as { token: string }).token);
  });

  it('does not echo submitted tokens and returns a purpose-bound proof only after success', async () => {
    const verify = vi.fn(async (_context: unknown, _input: unknown) => ({ accepted: true as const, value: { record: 'record:one', verified: true, subjectType: 'member', subject: 'member:one',
      purpose: 'member_code', operation: 'verification.member.inspect', proofExpiresAt: new Date('2026-09-05T00:01:00.000Z') } }));
    const response = await new ChallengesVerifyHandler({ issue: vi.fn(), verify }).execute({ path: { challengeid: 'verification:one' }, body: { token: 'secret-token', device: 'device-fingerprint' } } as never, context() as never);
    expect(response.body).toHaveProperty('proof', expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
    expect(response.body).not.toHaveProperty('token');
    expect(JSON.stringify(verify.mock.calls[0]?.[1])).not.toContain('secret-token');
    expect(JSON.stringify(verify.mock.calls[0]?.[1])).not.toContain('device-fingerprint');
  });
});

function context() {
  return {
    transaction: {},
    security: { kind: 'session', access: { actor: { id: 'principal:one' }, membership: { id: 'membership:one' }, scope: { id: 'store:one' }, trace: 'trace:one' } },
  };
}
