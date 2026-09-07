import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MPCartInvoiceDisclosure } from './MPCartInvoiceDisclosure';

function render(expanded: boolean) {
  return renderToStaticMarkup(React.createElement(MPCartInvoiceDisclosure, {
    expanded,
    invoiceHeader: '测试企业抬头',
    onEdit: vi.fn(),
    onToggle: vi.fn(),
  }));
}

describe('mini-program cart invoice disclosure', () => {
  it('defaults to no invoice and keeps invoice details hidden', () => {
    const html = render(false);

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('默认不开票，有需要时再添加');
    expect(html).not.toContain('测试企业抬头');
  });

  it('reveals invoice details only after the user opens it', () => {
    const html = render(true);

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('测试企业抬头');
    expect(html).toContain('修改');
  });
});
