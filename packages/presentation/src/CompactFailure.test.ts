import { describe, expect, it } from 'vitest';
import { compactFailure } from './CompactFailure';

describe('compact failure presentation', () => {
  it('keeps authentication and retry semantics without exposing raw errors', () => {
    expect(compactFailure({ kind: 'api', code: 'AUTHENTICATION_REQUIRED', retryable: false })).toEqual({ message: '登录状态已失效，请重新登录。', authenticationRequired: true, retryable: false });
    expect(compactFailure({ kind: 'transport', code: 'OFFLINE', retryable: true })).toMatchObject({ authenticationRequired: false, retryable: true });
    expect(compactFailure(new Error('database password leaked')).message).not.toContain('password');
  });
});
