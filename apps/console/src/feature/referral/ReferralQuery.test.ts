import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readReferral } from './ReferralQuery';

afterEach(() => vi.unstubAllGlobals());

describe('referral query authorization errors', () => {
  it('preserves a server 403 as an ApiError for the shared access boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'REFERRAL_SETTINGS_READ_DENIED',
              message: 'Access denied',
              requestId: 'request:referral:403',
              retryable: false,
            }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          )
        )
      )
    );

    await expect(readReferral(context, 'settings', undefined, new AbortController().signal)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'REFERRAL_SETTINGS_READ_DENIED',
      status: 403,
      requestId: 'request:referral:403',
    });
  });
});

const scope = Object.freeze({ kind: 'mall' as const, id: 'mall:1', name: '测试商城' });
const context: ConsoleContext = {
  session: {
    actor: 'actor:1',
    membership: 'membership:1',
    accessVersion: 1,
    permissions: ['referral.settings.read'],
    capabilities: ['referral.settings.read'],
    target: 'console' as const,
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    syncedAt: '2026-08-30T00:00:00.000Z',
  },
  profile: { display_name: '测试用户', employee_no: null },
  scope,
  scopes: [scope],
};
