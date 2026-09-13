// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { claimRecentConsoleSession, markConsoleResumeAttempt, rememberConsoleSession } from './consoleResume';

const ORIGIN = 'https://console.hbbtzn.com';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('console session resume hint', () => {
  it('claims a recent session without contacting Identity first', () => {
    rememberConsoleSession(ORIGIN, 1_000);
    expect(claimRecentConsoleSession(ORIGIN, 2_000)).toBe(true);
  });

  it('drops the hint when Console returns to Identity inside the loop window', () => {
    rememberConsoleSession(ORIGIN, 1_000);
    markConsoleResumeAttempt(ORIGIN, 1_500);
    expect(claimRecentConsoleSession(ORIGIN, 2_000)).toBe(false);
    expect(claimRecentConsoleSession(ORIGIN, 2_001)).toBe(false);
  });

  it('never redirects a hint to a different Console origin', () => {
    rememberConsoleSession('https://console.attacker.test', 1_000);
    expect(claimRecentConsoleSession(ORIGIN, 2_000)).toBe(false);
  });
});
