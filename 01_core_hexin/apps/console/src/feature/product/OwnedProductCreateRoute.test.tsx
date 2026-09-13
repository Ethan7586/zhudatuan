import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './OwnedProductCreateRoute';

let uploadedPackage: Record<string, unknown> | undefined;
const server = setupServer(http.post('*/api/v1/catalog/imports', async ({ request }) => {
  const body = await request.json() as { content?: string };
  uploadedPackage = JSON.parse(body.content ?? '{}') as Record<string, unknown>;
  return HttpResponse.json({
    id: 'catalogimport:owned-1', state: 'uploaded', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0,
  });
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); uploadedPackage = undefined; window.localStorage.clear(); server.resetHandlers(); });
afterAll(() => server.close());

describe('Owned product creation page', () => {
  it('switches between single entry and batch import on the same page', async () => {
    const user = userEvent.setup();
    renderRoute();

    expect(screen.getByRole('button', { name: /单个录入/ }).getAttribute('aria-current')).toBe('page');
    await user.click(screen.getByRole('button', { name: /批量导入/ }));
    expect(screen.getByRole('button', { name: /批量导入/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('region', { name: '批量导入自有商品' })).toBeTruthy();
    expect(screen.getByLabelText('选择标准货盘包')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /单个录入/ }));
    expect(screen.getByRole('button', { name: /基础信息/ })).toBeTruthy();
  });

  it('collects the three-step form, previews completeness and opens server confirmation', async () => {
    const user = userEvent.setup();
    renderRoute();

    expect(screen.getByRole('heading', { name: '新建自有商品' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /基础信息/ }).getAttribute('aria-current')).toBe('step');
    await user.type(screen.getByLabelText(/商品标题/), '宏泰轻享保温杯');
    await user.type(screen.getByLabelText(/商品副标题/), '通勤随行 316 不锈钢');
    await user.type(screen.getByLabelText(/商品分类/), 'personal');
    await user.type(screen.getByLabelText(/品牌/), '宏泰生活');
    await user.type(screen.getByLabelText(/图片 HTTPS 地址/), 'https://media.example.com/cup.jpg');
    expect(screen.getByRole('progressbar', { name: '资料完整度' }).getAttribute('aria-valuenow')).toBe('50');

    await user.click(screen.getByRole('button', { name: '下一步：规格与价格' }));
    await user.type(screen.getByLabelText(/售价/), '99.00');
    await user.type(screen.getByLabelText(/划线价/), '129.00');
    await user.type(screen.getByLabelText(/成本价/), '45.00');
    expect((screen.getByLabelText(/SKU 编码/) as HTMLInputElement).value).toMatch(/^OWN-/);

    await user.click(screen.getByRole('button', { name: '下一步：配送与服务' }));
    await user.type(screen.getByLabelText(/商品重量/), '350');
    await user.type(screen.getByLabelText(/运费模板/), '全国包邮');
    await user.type(screen.getByLabelText(/商品描述/), '轻量保温杯，适合办公室和通勤使用。');
    expect(screen.getByRole('progressbar', { name: '资料完整度' }).getAttribute('aria-valuenow')).toBe('100');

    await user.click(screen.getByRole('button', { name: '预览并确认' }));
    await waitFor(() => expect(screen.getByTestId('route-location').textContent)
      .toBe('/scopes/mall/mall%3Ahongtai/imports/catalog/catalogimport%3Aowned-1'));
    const item = (uploadedPackage?.items as Array<Record<string, unknown>>)[0]!;
    expect(item.product).toMatchObject({ title: '宏泰轻享保温杯', category: 'personal',
      attributes: { entryMode: 'manual', subtitle: '通勤随行 316 不锈钢', brand: '宏泰生活', procurementCostMinor: 4500, weightGrams: 350 } });
    expect(item.offer).toMatchObject({ amountMinor: 9900, compareMinor: 12900 });
  });

  it('stores a recoverable browser draft without submitting it', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.type(screen.getByLabelText(/商品标题/), '待续填商品');
    await user.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(await screen.findByText('草稿已保存在当前浏览器，可稍后继续填写。')).toBeTruthy();
    expect(window.localStorage.getItem('console:owned-product-draft:mall:mall:hongtai')).toContain('待续填商品');
    expect(uploadedPackage).toBeUndefined();
  });
});

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter initialEntries={['/scopes/mall/mall%3Ahongtai/products/owned/new']}>
    <QueryClientProvider client={client}><ConsoleContextProvider value={context}><Component /><RouteLocation /></ConsoleContextProvider></QueryClientProvider>
  </MemoryRouter>);
}

function RouteLocation() {
  const location = useLocation();
  return <output hidden data-testid="route-location">{location.pathname}</output>;
}

const scope = { kind: 'mall' as const, id: 'mall:hongtai', name: '宏泰甄选' };
const context: ConsoleContext = {
  session: {
    actor: 'actor:owned-product', membership: 'membership:owned-product', accessVersion: 1, csrf: 'csrf:owned-product',
    permissions: ['catalog.import.manage', 'catalog.import.read'], capabilities: ['catalog.imports.create', 'catalog.imports.read'],
    target: 'console', scope, scopes: [scope], assurance: { level: 2 }, syncedAt: '2026-09-14T00:00:00.000Z',
  },
  profile: { display_name: '商品运营', employee_no: null }, scope, scopes: [scope],
};
