import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouteLoading } from './RouteLoading';

describe('RouteLoading', () => {
  it('announces the route loading state', () => {
    render(<RouteLoading />);
    expect(screen.getByRole('status').textContent).toContain('正在加载');
  });
});
// @vitest-environment jsdom
