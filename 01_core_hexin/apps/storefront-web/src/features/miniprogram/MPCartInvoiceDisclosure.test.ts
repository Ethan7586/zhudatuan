import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DeliveryAddress } from '../../types';
import { MPCartInvoiceDisclosure } from './MPCartInvoiceDisclosure';

function render(expanded: boolean, defaultAddress?: DeliveryAddress) {
  return renderToStaticMarkup(React.createElement(MPCartInvoiceDisclosure, {
    defaultAddress,
    expanded,
    importingWechatAddress: false,
    onEditAddress: vi.fn(),
    onEdit: vi.fn(),
    onImportWechatAddress: vi.fn(),
    onToggle: vi.fn(),
  }));
}

describe('mini-program cart invoice disclosure', () => {
  it('defaults to no invoice and keeps invoice details hidden', () => {
    const html = render(false);

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('配送等');
    expect(html).toContain('选填');
    expect(html).not.toContain('配送与发票等特殊需求');
    expect(html).not.toContain('获取微信地址');
    expect(html).not.toContain('电子发票');
  });

  it('reveals invoice details only after the user opens it', () => {
    const html = render(true);

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('收货地址');
    expect(html).toContain('填写默认地址');
    expect(html).toContain('获取微信地址');
    expect(html).toContain('电子发票');
    expect(html).toContain('（选填）');
    expect(html).toContain('默认不开具');
    expect(html).toContain('添加');
  });

  it('shows the saved default address inside delivery options', () => {
    const html = render(true, {
      id: 'address:one',
      name: '张三',
      phone: '13800000000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '文一路 1 号',
      isDefault: true,
    });

    expect(html).toContain('默认');
    expect(html).toContain('张三 · 13800000000');
    expect(html).toContain('浙江省 杭州市 西湖区 文一路 1 号');
    expect(html).toContain('管理地址');
  });
});
