// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspacePage } from './WorkspacePage';

afterEach(cleanup);

describe('WorkspacePage', () => {
  it('keeps the fixed header, controls, resource and layer order', () => {
    render(<WorkspacePage label="商品治理台" className="productpage" drawerOpen={false} header={<header>商品标题</header>} controls={<form>商品筛选</form>} condition="ready" layers={<aside>商品抽屉</aside>}><table><tbody><tr><td>商品列表</td></tr></tbody></table></WorkspacePage>);
    const page = screen.getByRole('region', { name: '商品治理台' });
    expect(page.classList.contains('workspacepage')).toBe(true);
    expect(page.getAttribute('data-drawer')).toBe('closed');
    expect(Array.from(page.children).map((child) => child.tagName)).toEqual(['HEADER', 'FORM', 'TABLE', 'ASIDE']);
  });

  it('isolates a resource failure while preserving the page header and controls', () => {
    render(<WorkspacePage label="商品治理台" header={<header>商品标题</header>} controls={<form>商品筛选</form>} condition="failure" error="商品列表暂时不可用"><span>不会显示</span></WorkspacePage>);
    expect(screen.getByText('商品标题')).toBeTruthy();
    expect(screen.getByText('商品筛选')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('商品列表暂时不可用')).toBeTruthy();
  });
});
