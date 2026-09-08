import { describe, expect, it } from 'vitest';
import { Failure, mapFailure, statusFailure } from './Failure';

describe('Failure', () => {
  it('keeps a safe code, classification and retry decision without exposing the original exception', () => {
    const cause = new Error('provider bearer leaked');
    const mapped = mapFailure(cause, { code: 'PROVIDER_TRANSPORT_FAILED', kind: 'transport', retryable: true });

    expect(mapped).toMatchObject({ code: 'PROVIDER_TRANSPORT_FAILED', kind: 'transport', retryable: true });
    expect(mapped.message).not.toContain('bearer');
    expect(mapped.cause).toBe(cause);
    expect(mapFailure(mapped, { code: 'IGNORED_FAILURE', kind: 'unknown', retryable: false })).toBe(mapped);
  });

  it.each([
    [401, 'authentication', false],
    [409, 'conflict', false],
    [429, 'ratelimit', true],
    [503, 'unavailable', true],
  ] as const)('classifies HTTP status %s', (status, kind, retryable) => {
    expect(statusFailure('PROVIDER_REJECTED', status)).toMatchObject({ status, kind, retryable });
  });

  it('rejects unbounded or malformed failure data', () => {
    expect(() => new Failure('secret leaked', 'unknown', false)).toThrow('FAILURE_INVALID');
    expect(() => new Failure('VALID_CODE', 'unknown', false, 700)).toThrow('FAILURE_INVALID');
  });
});
