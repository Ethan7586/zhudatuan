// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createAuthorization } from '../../src/shared/security/Authorization';
import { AuthorizationJourney } from '../../src/shared/security/AuthorizationJourney';

describe('authorization journey', () => {
  it('keeps a registration authorization only in memory until its server expiry', async () => {
    let now = Date.parse('2026-09-09T00:00:00.000Z');
    const journey = new AuthorizationJourney(() => now);
    const authorization = await createAuthorization();
    journey.remember('enrollment-one', '2026-09-09T00:05:00.000Z', authorization);
    expect(journey.require('enrollment-one')).toBe(authorization);
    expect(JSON.stringify(window.sessionStorage)).not.toContain(authorization.secret.verifier);
    now += 300_000;
    expect(() => journey.require('enrollment-one')).toThrow('SESSION_CONTEXT_MISSING');
  });

  it('clears a completed registration without affecting another pending journey', async () => {
    const journey = new AuthorizationJourney(() => Date.parse('2026-09-09T00:00:00.000Z'));
    const first = await createAuthorization();
    const second = await createAuthorization();
    journey.remember('enrollment-one', '2026-09-09T00:05:00.000Z', first);
    journey.remember('enrollment-two', '2026-09-09T00:05:00.000Z', second);
    journey.clear('enrollment-one');
    expect(() => journey.require('enrollment-one')).toThrow('SESSION_CONTEXT_MISSING');
    expect(journey.require('enrollment-two')).toBe(second);
  });
});
