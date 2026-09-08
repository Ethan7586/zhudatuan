import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Listing, ProductBatch } from '../model/Product';
import { ProductBatchDialog } from '../view/ProductBatchDialog';
import { useProductBatchViewModel } from './ProductBatchViewModel';
import { listingFixture } from '../test/ProductFixture';

afterEach(() => cleanup());

describe('ProductBatchViewModel', () => {
  it('previews before execution, shows row receipts and retries only failed items', async () => {
    const preview = vi
      .fn()
      .mockResolvedValueOnce(batch('preview', [item('listing:one', 'ready', 3), item('listing:two', 'ready', 3)]))
      .mockResolvedValueOnce(batch('preview', [item('listing:two', 'ready', 4)]));
    const execute = vi.fn().mockResolvedValue(batch('executed', [item('listing:one', 'succeeded', 4), item('listing:two', 'failed', 4, 'VERSION_CONFLICT')]));
    const dependencies = dependency(preview, execute);
    const user = userEvent.setup();
    renderHarness(dependencies);

    await user.click(screen.getByRole('button', { name: '批量上架所选商品' }));
    expect(await screen.findByRole('heading', { name: '批量上架' })).toBeTruthy();
    expect(await screen.findByText('办公福利礼盒')).toBeTruthy();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '确认执行 2 项' }));

    expect(await screen.findByText('已完成')).toBeTruthy();
    expect(screen.getByText('商品版本已变化，请重新预检')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '仅重试 1 个失败项' }));
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    const failedListing = listings[1];
    if (failedListing === undefined) throw new Error('TEST_FAILED_LISTING_MISSING');
    expect(preview.mock.calls[1]?.[1]).toEqual([{ ...failedListing, version: 4 }]);
    expect(execute.mock.calls[0]?.[0]).toHaveProperty('identity');
    expect(execute).toHaveBeenCalledWith(expect.anything(), listings, 'publish', expect.objectContaining({ phase: 'preview', previewHash: 'a'.repeat(64) }));
  });

  it('does not expose a batch action when the operation is unavailable', () => {
    const denied = { ...context, session: { ...context.session, capabilities: context.session.capabilities.filter((value) => value !== 'catalog.listings.batch') } };
    renderHarness(dependency(vi.fn(), vi.fn()), denied);
    expect(screen.getByRole('button', { name: '批量上架所选商品' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('当前账号没有批量上架或下架商品的权限。')).toBeTruthy();
  });
});

function renderHarness(dependencies: ProductDependencies, value = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness context={value} dependencies={dependencies} />
    </QueryClientProvider>
  );
}

function Harness({ context: value, dependencies }: Readonly<{ context: ConsoleContext; dependencies: ProductDependencies }>) {
  const model = useProductBatchViewModel(
    value,
    dependencies,
    () => undefined,
    () => undefined
  );
  return (
    <>
      <button type="button" disabled={!model.allowed} onClick={() => model.actions.open(true, listings)}>
        批量上架所选商品
      </button>
      {model.permissionReason ? <span>{model.permissionReason}</span> : null}
      <ProductBatchDialog viewmodel={model} />
    </>
  );
}

function dependency(preview: ReturnType<typeof vi.fn>, execute: ReturnType<typeof vi.fn>): ProductDependencies {
  let sequence = 0;
  return { previewBatch: { execute: preview }, executeBatch: { execute }, createIdentity: () => `command:${++sequence}` } as unknown as ProductDependencies;
}

function batch(phase: ProductBatch['phase'], items: ProductBatch['items']): ProductBatch {
  const count = items.filter(({ state }) => state === (phase === 'preview' ? 'ready' : 'succeeded')).length;
  return { phase, action: 'publish', previewHash: 'a'.repeat(64), items, count, failed: items.length - count };
}

function item(id: string, state: ProductBatch['items'][number]['state'], version: number, error: string | null = null): ProductBatch['items'][number] {
  return { id, state, status: state === 'failed' ? null : 'published', version, error, gaps: [] };
}

const listings: readonly Listing[] = [listing('one', '办公福利礼盒'), listing('two', '中秋员工礼盒')];
function listing(id: string, title: string): Listing {
  return listingFixture({
    id: `listing:${id}`,
    sku_id: `sku:${id}`,
    product_id: `product:${id}`,
    title,
    status: 'draft',
  });
}

const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', name: '华东福利商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 7,
    permissions: ['catalog.listing.manage'],
    capabilities: ['catalog.listings.batch'],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    target: 'console',
    csrf: 'csrf:one',
    syncedAt: '2026-09-07T08:00:00.000Z',
  },
  profile: { display_name: '商品运营', employee_no: null },
  scopes: [scope],
  scope,
};
