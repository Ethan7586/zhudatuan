import { describe, expect, it } from 'vitest';
import { ApiError } from '@shop/sdk/error';
import { hasFailureCode } from './Failure';
import { presentError, presentFailure, safeQueryError } from './PresentFailure';

describe('presentFailure', () => {
  it('presents a typed failure without exposing a raw message', () => {
    const view = presentFailure({ kind: 'api', code: 'CREDENTIAL_INVALID', retryable: false, requestId: 'request-one' });
    expect(view.message).toContain('凭证');
    expect(view.requestId).toBe('request-one');
  });

  it('supports transport recovery actions', () => {
    expect(presentFailure({ kind: 'transport', code: 'OFFLINE', retryable: true }).action.kind).toBe('retry');
  });

  it('maps application failures through generated policy without exposing diagnostics', () => {
    const cause = new ApiError('STEPUP_REQUIRED', 403, 'request-one');
    expect(safeQueryError(cause)).toBe('当前身份没有执行此操作的权限。');
    expect(presentError(new Error('raw database detail')).message).not.toContain('database');
    expect(hasFailureCode(cause, 'STEPUP_REQUIRED')).toBe(true);
  });
});
