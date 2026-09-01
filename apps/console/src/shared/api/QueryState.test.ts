import { ApiError } from '@shop/sdk';
import { describe, expect, it } from 'vitest';
import { queryCondition, queryErrorCode, safeQueryError } from './QueryState';

describe('console query state', () => {
  it('replaces step-up protocol details with an actionable Chinese message', () => {
    const error = new ApiError('STEPUP_REQUIRED', 403, '13cb4ac4-df30-4d9d-95ea-18ccab852559');

    const message = safeQueryError(error);

    expect(message).toBe('为保护敏感数据，请先完成二次验证后重试。');
    expect(message).not.toContain('STEPUP_REQUIRED');
    expect(message).not.toContain(error.requestId);
    expect(queryErrorCode(error, 'STEPUP_REQUIRED')).toBe(true);
  });

  it.each([
    [new ApiError('AUTHENTICATION_REQUIRED', 401, 'request:session'), '登录状态已失效，请重新登录。'],
    [new ApiError('PERMISSION_DENIED', 403, 'request:permission'), '当前账号没有执行此操作的权限，请联系管理员。'],
    [new ApiError('RATE_LIMITED', 429, 'request:rate'), '操作过于频繁，请稍后再试。'],
    [new ApiError('VERSION_CONFLICT', 409, 'request:version'), '数据已发生变化，请刷新后重新操作。'],
    [new ApiError('INTERNAL_ERROR', 500, 'request:server'), '服务暂时不可用，请稍后重试。'],
  ])('maps API failures without exposing protocol diagnostics', (error, expected) => {
    const message = safeQueryError(error);

    expect(message).toBe(expected);
    expect(message).not.toContain(error.code);
    expect(message).not.toContain(error.requestId);
  });

  it('keeps access-state classification independent from presentation copy', () => {
    const error = new ApiError('STEPUP_REQUIRED', 403, 'request:stepup');

    expect(queryCondition({ pending: false, fetching: false, error, hasData: false, empty: true })).toBe('denied');
  });

  it('keeps successful cached data ready until a refresh actually fails', () => {
    expect(queryCondition({ pending: false, fetching: false, error: null, hasData: true, empty: false })).toBe('ready');
    expect(queryCondition({ pending: false, fetching: false, error: new Error('NETWORK_FAILURE'), hasData: true, empty: false })).toBe('stale');
  });
});
