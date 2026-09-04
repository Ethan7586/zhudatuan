import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../app/DependencyContext';
import { createConsoleDependencies } from '../../app/Dependencies';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { StepupProvider } from '../../entity/session/StepupContext';
import { Component } from './route/VoucherRoute';

const requests: string[] = [];
const writes: string[] = [];
const server = setupServer(
  http.get('*/api/v1/vouchers/product-options', () => HttpResponse.json(productOptions)),
  http.get('*/api/v1/vouchers/search/facets', () => HttpResponse.json(facets)),
  http.get('*/api/v1/vouchers/search', () => HttpResponse.json({ items: [voucher], count: 1 })),
  http.get('*/api/v1/vouchers/by-number/:number', () => HttpResponse.json(voucher)),
  http.get('*/api/v1/vouchers/:voucherid/timeline', () => HttpResponse.json(timeline)),
  http.get('*/api/v1/vouchers/products', ({ request }) => { requests.push(new URL(request.url).pathname); return HttpResponse.json(products); }),
  http.get('*/api/v1/vouchers/credential-pools', ({ request }) => { requests.push(new URL(request.url).pathname); return HttpResponse.json(pools); }),
  http.get('*/api/v1/vouchers/products/:productid', ({ params }) => HttpResponse.json(products.items.find(({ id }) => id === params.productid) ?? products.items[0])),
  http.post('*/api/v1/vouchers/credential-pools', async ({ request }) => { writes.push(JSON.stringify(await request.json())); return HttpResponse.json(pools.items[0], { status: 201 }); }),
  http.get('*/api/v1/vouchers/:voucherid', () => HttpResponse.json(voucher)),
  http.all('*/api/v1/vouchers/**', ({ request }) => { requests.push(new URL(request.url).pathname); return HttpResponse.json({ items: [], count: 0 }); })
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); requests.length = 0; writes.length = 0; currentSearch = ''; });
afterAll(() => server.close());

describe('Rich Voucher workspace', () => {
  it('renders scoped products, keeps LI workspace interaction and switches to credential pools through URL state', async () => {
    const user = userEvent.setup(); renderRoute('/vouchers');
    expect(await screen.findByRole('table', { name: '卡券产品' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '卡券中心' })).toBeTruthy();
    expect(screen.getByText('当前网站归属：鸿泰集团')).toBeTruthy();
    expect(screen.getAllByText('¥88.00')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '卡号库' }));
    expect(await screen.findByRole('table', { name: '卡号库' })).toBeTruthy();
    expect(new URLSearchParams(currentSearch).get('view')).toBe('pools');
    expect(requests).toContain('/api/v1/vouchers/credential-pools');
  });

  it('opens a server-refreshed drawer and submits a real credential-pool command', async () => {
    const user = userEvent.setup(); renderRoute('/vouchers?view=products&campaign=keep');
    await screen.findByRole('table', { name: '卡券产品' });
    await user.type(screen.getByRole('searchbox', { name: '搜索当前卡券视图' }), '中秋');
    expect(screen.getByText('中秋关怀券')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '查看中秋关怀券摘要' }));
    const drawer = await screen.findByRole('dialog', { name: '中秋关怀券' });
    expect(within(drawer).getByText(/权威服务端模型/)).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: '关闭' }));
    await user.click(screen.getByRole('button', { name: '卡号库' }));
    await screen.findByRole('table', { name: '卡号库' });
    await user.click(screen.getByRole('button', { name: '新建卡号库' }));
    const dialog = await screen.findByRole('dialog', { name: '新建卡号库' });
    await user.selectOptions(await within(dialog).findByRole('combobox', { name: '卡券产品' }), 'voucherproduct:one');
    await fill(user, dialog, '卡号库名称', '中秋凭证池');
    await fill(user, dialog, '卡号前缀', 'AUTUMN');
    await user.click(within(dialog).getByRole('button', { name: '确认提交' }));
    await waitFor(() => expect(writes[0]).toContain('"product":"voucherproduct:one"'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建卡号库' })).toBeNull());
  });

  it('keeps a full voucher number out of the URL and renders the authoritative timeline', async () => {
    const user = userEvent.setup(); renderRoute('/vouchers?view=search&campaign=keep');
    await screen.findByRole('table', { name: '统一检索' });
    const number = screen.getByLabelText('完整券号');
    await user.type(number, 'AUTUMN20260001');
    await user.click(screen.getByRole('button', { name: '精准查询' }));
    const result = await screen.findByRole('button', { name: '打开精准查询结果 AUTUMN***0001' });
    expect(currentSearch).not.toContain('AUTUMN20260001');
    await user.click(result);
    const drawer = await screen.findByRole('dialog', { name: 'AUTUMN***0001' });
    expect(await within(drawer).findByRole('heading', { name: '生命周期时间线' })).toBeTruthy();
    expect(within(drawer).getByText('可用 → 已绑定')).toBeTruthy();
  });
});

async function fill(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, label: string, value: string) { const input = within(dialog).getByRole('textbox', { name: new RegExp(label) }); await user.clear(input); await user.type(input, value); }
let currentSearch = '';
function LocationProbe() { currentSearch = useLocation().search; return null; }
function renderRoute(entry: string) { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return render(<MemoryRouter initialEntries={[entry]}><QueryClientProvider client={client}><ConsoleContextProvider value={context}><StepupProvider controller={{ request: () => undefined }}><DependencyProvider value={createConsoleDependencies()}><LocationProbe /><Component /></DependencyProvider></StepupProvider></ConsoleContextProvider></QueryClientProvider></MemoryRouter>); }

const context: ConsoleContext = { session: { actor: 'actor:voucher', membership: 'membership:voucher', accessVersion: 7,
  permissions: ['voucher.product.read', 'voucher.product.manage', 'voucher.credential.read', 'voucher.credential.manage', 'voucher.search.read', 'voucher.holder.read'],
  capabilities: ['voucher.products.list', 'voucher.products.get', 'voucher.products.create', 'voucher.products.revise', 'voucher.products.enable', 'voucher.products.disable', 'voucher.productoptions.list', 'voucher.credentialpools.list', 'voucher.credentialpools.get', 'voucher.credentialpools.create', 'voucher.search.read', 'voucher.searchfacets.read', 'voucher.vouchers.get', 'voucher.vouchers.getbynumber', 'voucher.vouchers.timeline'],
  target: 'console', scope: { kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' }, scopes: [{ kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' }], assurance: { level: 3 }, security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null }, csrf: 'csrf-token-at-least-sixteen-characters', syncedAt: '2026-09-04T00:00:00.000Z' },
  profile: { display_name: '测试卡券运营', employee_no: null }, scope: { kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' }, scopes: [{ kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' }] };
const validity = { startsAt: '2026-09-04T00:00:00.000Z', expiresAt: '2027-09-04T00:00:00.000Z' };
const products = { items: [{ id: 'voucherproduct:one', number: 'VP202609040001', scopeId: 'platform:commerce', customer: 'customer:one', name: '中秋关怀券', faceMinor: 8800, currency: 'CNY', qualification: 'qualification:one', pool: 'pool:one', validity, activation: 'automatic', approvalRequired: true, state: 'enabled', version: 2, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:01:00.000Z' }], count: 1 };
const pools = { items: [{ id: 'pool:one', number: 'CP202609040001', scopeId: 'platform:commerce', product: 'voucherproduct:one', name: '中秋凭证池', mode: 'generated', prefix: 'AUTUMN', capacity: 1000, generated: 0, available: 0, allocated: 0, state: 'open', version: 1, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' }], count: 1 };
const productOptions = { items: [{ id: 'voucherproduct:one', number: 'VP202609040001', name: '中秋关怀券', faceMinor: 8800, currency: 'CNY', available: 900 }], count: 1 };
const voucher = { id: 'voucher:one', numberMasked: 'AUTUMN***0001', scopeId: 'platform:commerce', product: 'voucherproduct:one', productName: '中秋关怀券', credential: 'credential:one', holder: 'member:one', initialMinor: 8800, remainingMinor: 8800, currency: 'CNY', state: 'bound', validity, version: 2, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:01:00.000Z' };
const facets = { states: [{ value: 'bound', count: 1 }], products: [{ value: 'voucherproduct:one', count: 1 }], pools: [{ value: 'pool:one', count: 1 }], watermark: '2026-09-04T00:01:00.000Z' };
const timeline = { items: [{ sequence: 1, previous: 'available', next: 'bound', reason: '成员主动领取', actor: 'membership:operator', occurredAt: '2026-09-04T00:01:00.000Z', redemption: null }], count: 1 };
