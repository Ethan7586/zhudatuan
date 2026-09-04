import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ResourceState } from './ResourceState';
import { RouteFallback } from './RouteFallback';

describe('route fallback', () => {
  it('renders a shared, announced loading state while lazy routes resolve', () => {
    const result = RouteFallback();
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ 'aria-label': string; children: unknown }>(result)) {
      throw new Error('ROUTE_FALLBACK_ELEMENT_REQUIRED');
    }
    expect(result.props['aria-label']).toBe('页面加载状态');
    expect(isValidElement(result.props.children) && result.props.children.type).toBe(ResourceState);
  });
});
