import { describe, expect, it } from 'vitest';
import { ApiError } from '@shop/sdk/error';
import { productionError } from './productionApi.error';

describe('production API error', () => {
  it('translates legacy WebView fetch failures into a useful Chinese message', () => {
    const error = productionError(new TypeError('Failed to fetch'));
    expect(error.code).toBe('NETWORK_OR_CLIENT_ERROR');
    expect(error.message).toBe('网络连接已中断，恢复后将自动重试');
  });

  it('never exposes a raw API code or an English fallback message', () => {
    expect(productionError(new ApiError('NOT_FOUND', 404, 'request:one')).message).toBe('请求的内容仍在同步，请稍后重试');
    expect(productionError(new ApiError('CONTRACT_VERSION_UNSUPPORTED', 426, 'request:version')).message)
      .toBe('商城服务已升级，请刷新页面后重试');
    expect(productionError(new ApiError('CHECKOUT_REJECTED', 422, 'request:checkout')).message)
      .toBe('商品状态已变化，请确认购物车后重新结算');
    expect(productionError(new ApiError('UPSTREAM_BROKEN', 502, 'request:two', false, undefined, 'Bad Gateway')).message).toBe('商城服务暂时繁忙，请稍后重试');
    expect(productionError(new Error('Unexpected token')).message).toBe('商城服务暂时不可用，请稍后重试');
  });
});
