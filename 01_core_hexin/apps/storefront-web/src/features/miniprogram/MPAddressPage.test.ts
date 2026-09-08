import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/mobile/WeChatCapsule', () => ({ WeChatCapsule: () => null }));
vi.mock('../../context/MallContext', () => ({
  useMall: () => ({
    addresses: [],
    addAddress: vi.fn(),
    setDefaultAddress: vi.fn(),
    mpAddressReturnPage: 'cart',
    setMpPage: vi.fn(),
    showToast: vi.fn(),
  }),
}));

import { MPAddressPage } from './MPAddressPage';

describe('mini-program address page', () => {
  it('offers smart paste, WeChat import and one linked region selector', () => {
    const html = renderToStaticMarkup(React.createElement(MPAddressPage));
    expect(html).toContain('粘贴并识别');
    expect(html).toContain('从微信选择地址');
    expect(html).toContain('请选择省 / 市 / 区');
    expect(html).toContain('aria-label="整段收货地址"');
    expect(html).not.toContain('placeholder="广东省"');
    expect(html).not.toContain('placeholder="深圳市"');
    expect(html).not.toContain('placeholder="南山区"');
    expect((html.match(/<input/g) ?? []).length).toBe(3);
  });

  it('fills the form after WeChat import without saving automatically', () => {
    const source = readFileSync(new URL('./MPAddressPage.tsx', import.meta.url), 'utf8');
    const importFlow = source.slice(source.indexOf('const importFromWechat'), source.indexOf('const save'));
    expect(importFlow).toContain('setForm(imported)');
    expect(importFlow).not.toContain('addAddress(');
  });
});
