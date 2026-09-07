import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MPCartInvoiceDisclosure } from './MPCartInvoiceDisclosure';

function render(expanded: boolean) {
  return renderToStaticMarkup(React.createElement(MPCartInvoiceDisclosure, {
    expanded,
    onEdit: vi.fn(),
    onToggle: vi.fn(),
  }));
}

describe('mini-program cart invoice disclosure', () => {
  it('defaults to no invoice and keeps invoice details hidden', () => {
    const html = render(false);

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('更多结算服务');
    expect(html).toContain('有特殊要求时再设置');
    expect(html).not.toContain('电子发票');
  });

  it('reveals invoice details only after the user opens it', () => {
    const html = render(true);

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('电子发票');
    expect(html).toContain('默认不开具');
    expect(html).toContain('添加');
  });
});
