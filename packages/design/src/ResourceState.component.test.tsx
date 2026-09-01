import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Empty } from './Empty';
import { ContextualAccessDenied } from './AccessDenied';
import { ErrorView } from './Error';
import { ResourceState, resourceCondition, resourceConditions, type ResourceCondition } from './ResourceState';

describe('resource state contract', () => {
  it('exposes the complete asynchronous state union', () => {
    expect(resourceConditions).toEqual(['loading', 'empty', 'ready', 'refreshing', 'stale', 'unauthenticated', 'denied', 'notfound', 'conflict', 'ratelimited', 'offline', 'failure', 'retry']);
  });

  it.each([
    [undefined, 0, undefined, 'loading'],
    [[], 0, undefined, 'empty'],
    [[{ id: '1' }], 1, undefined, 'ready'],
    [undefined, 0, 'AUTHORIZATION_DENIED', 'failure'],
    [undefined, 0, 'NETWORK_OFFLINE', 'failure'],
    [undefined, 0, 'VERSION_CONFLICT', 'failure'],
  ] as const)('derives only data lifecycle states and never classifies message text', (data, rows, error, expected) => {
    expect(resourceCondition(data, rows, error)).toBe(expected);
  });

  it.each(['notfound', 'conflict', 'ratelimited', 'offline', 'failure'] as const)('renders %s as an explicit error boundary', (condition: ResourceCondition) => {
    const result = ResourceState({ condition, error: 'FAILURE_CODE', retry: () => undefined, children: 'ready' });
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ message: string }>(result)) throw new Error('RESOURCE_STATE_ELEMENT_REQUIRED');
    expect(result.type).toBe(ErrorView);
    expect(result.props.message).toBe('FAILURE_CODE');
  });

  it.each([
    ['unauthenticated', 'unauthenticated'],
    ['denied', undefined],
  ] as const)('renders %s with the calm access boundary instead of a load failure', (condition, kind) => {
    const result = ResourceState({ condition, resourceLabel: '分销系统', error: 'PERMISSION_DETAIL', children: 'ready' });
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ kind?: string; resourceLabel: string; detail?: string }>(result)) throw new Error('ACCESS_DENIED_ELEMENT_REQUIRED');
    expect(result.type).toBe(ContextualAccessDenied);
    expect(result.props.kind).toBe(kind);
    expect(result.props.resourceLabel).toBe('分销系统');
    expect(result.props.detail).toBeUndefined();
  });

  it('forwards an explicit denied description without exposing transport errors', () => {
    const result = ResourceState({
      condition: 'denied',
      resourceLabel: '经营驾驶舱',
      deniedDescription: '账号已登录，等待管理员授权。',
      error: 'PERMISSION_DENIED · 请求 request:one',
      children: 'ready',
    });
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ description?: string }>(result)) throw new Error('ACCESS_DENIED_ELEMENT_REQUIRED');
    expect(result.type).toBe(ContextualAccessDenied);
    expect(result.props.description).toBe('账号已登录，等待管理员授权。');
  });

  it('announces loading, renders empty and preserves ready children', () => {
    const loading = ResourceState({ condition: 'loading', children: 'ready' });
    expect(isValidElement(loading)).toBe(true);
    if (!isValidElement<{ role: string; 'aria-live': string }>(loading)) throw new Error('RESOURCE_LOADING_ELEMENT_REQUIRED');
    expect(loading.props.role).toBe('status');
    expect(loading.props['aria-live']).toBe('polite');

    const empty = ResourceState({ condition: 'empty', children: 'ready' });
    expect(isValidElement(empty) && empty.type).toBe(Empty);
    expect(ResourceState({ condition: 'ready', children: 'ready' })).toBe('ready');
  });

  it.each(['refreshing', 'retry'] as const)('keeps prior content during %s', (condition) => {
    const result = ResourceState({ condition, children: 'previous data' });
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ label: string; children: unknown }>(result)) throw new Error('RESOURCE_BUSY_ELEMENT_REQUIRED');
    expect(result.props.label).toMatch(/正在/);
    expect(result.props.children).toBe('previous data');
  });

  it('keeps prior content and an explicit refresh action when stale', () => {
    const result = ResourceState({ condition: 'stale', retry: () => undefined, children: 'previous data' });
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ message: string; retry: () => void; children: unknown }>(result)) throw new Error('RESOURCE_STALE_ELEMENT_REQUIRED');
    expect(result.props.message).toContain('最近一次成功读取');
    expect(result.props.retry).toBeTypeOf('function');
    expect(result.props.children).toBe('previous data');
  });
});
