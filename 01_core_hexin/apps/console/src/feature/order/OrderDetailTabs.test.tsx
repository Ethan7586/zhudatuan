import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderDetailTabs, orderDetailTabs } from './OrderDetailTabs';

afterEach(cleanup);

describe('OrderDetailTabs', () => {
  it('renders all five order detail labels through the same component', () => {
    const onSelectionChange = vi.fn();
    render(
      <OrderDetailTabs selected="overview" onSelectionChange={onSelectionChange}>
        <p>订单详情内容</p>
      </OrderDetailTabs>,
    );

    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(orderDetailTabs.map((tab) => tab.label));
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.querySelector('.orderdrawertablabel')).not.toBeNull();
    }

    fireEvent.click(screen.getByRole('tab', { name: '商品与履约' }));
    expect(onSelectionChange).toHaveBeenCalledWith('products');
  });

  it('keeps the tab selectors and optical offset in one authoritative stylesheet', () => {
    const sourceRoot = resolve(process.cwd(), 'src');
    const authority = resolve(sourceRoot, 'feature/order/order-detail-tabs.css');
    const selectorOwners = cssFiles(sourceRoot).filter((file) => {
      const css = readFileSync(file, 'utf8');
      return css.includes('orderdrawertabs') || css.includes('orderdrawertablabel');
    });
    const css = readFileSync(authority, 'utf8');

    expect(selectorOwners).toEqual([authority]);
    expect(css).toContain('padding: 0 13px');
    expect(css).toContain('transform: translateY(-1px)');
    expect(css).toContain('background: var(--order-blue-soft)');
    expect(css).not.toContain('::after');
  });
});

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.isFile() && entry.name.endsWith('.css') ? [path] : [];
  });
}
