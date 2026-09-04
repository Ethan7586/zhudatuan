// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Receipt } from './Receipt';

afterEach(cleanup);

describe('business receipt', () => {
  it('shows the object, impact, result evidence, time and safe next step', () => {
    render(<Receipt receipt={{ requestId: 'request:one', reference: 'mall:one', occurredAt: '2026-09-07T08:00:00.000Z', message: '商城已经发布。', next: { label: '查看商城', target: '/experience/malls/mall:one' } }} objectLabel="商城" impact="公开首页已经更新" />);
    expect(screen.getByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(screen.getByText('商城已经发布。')).toBeTruthy();
    expect(screen.getByText('mall:one')).toBeTruthy();
    expect(screen.getByText('公开首页已经更新')).toBeTruthy();
    expect(screen.getByText('request:one')).toBeTruthy();
    expect(screen.getByRole('link', { name: '查看商城' }).getAttribute('href')).toBe('/experience/malls/mall:one');
  });

  it('renders an untrusted next target as text instead of an executable link', () => {
    render(<Receipt receipt={{ requestId: 'request:two', reference: 'mall:two', occurredAt: '2026-09-07T08:00:00.000Z', message: '操作完成。', next: { label: '继续', target: 'javascript:alert(1)' } }} />);
    expect(screen.getByText('继续')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '继续' })).toBeNull();
  });
});
