import { describe, expect, it } from 'vitest';
import { productionError } from './productionApi.error';

describe('production API error', () => {
  it('translates legacy WebView fetch failures into a useful Chinese message', () => {
    const error = productionError(new TypeError('Failed to fetch'));
    expect(error.code).toBe('NETWORK_OR_CLIENT_ERROR');
    expect(error.message).toBe('商城网络连接失败，请刷新页面后重试');
  });
});
