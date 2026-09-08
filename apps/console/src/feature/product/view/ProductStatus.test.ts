import { describe, expect, it } from 'vitest';
import type { ResourceCondition } from '@shop/presentation';
import { presentProductStatus } from './ProductStatus';

describe('ProductStatus', () => {
  it.each([
    ['loading', '正在加载商品数据…'],
    ['refreshing', '正在同步商品数据…'],
    ['retry', '正在重新加载商品数据…'],
    ['ready', '商品数据已是最新'],
    ['empty', '商品数据已加载，当前无记录'],
    ['stale', '正在显示最近一次商品数据'],
    ['forbidden', '当前账号无权查看商品数据'],
    ['unavailable', '商品服务暂不可用'],
    ['notconfigured', '商品能力尚未配置'],
    ['notfound', '未找到商品数据'],
    ['conflict', '商品数据状态已发生变化'],
    ['ratelimited', '商品查询较多，请稍后重试'],
    ['offline', '当前离线，未加载最新商品数据'],
    ['failure', '商品数据加载失败'],
  ] satisfies ReadonlyArray<readonly [ResourceCondition, string]>)('presents %s without contradicting the resource state', (condition, expected) => {
    expect(presentProductStatus(condition)).toBe(expected);
  });
});
