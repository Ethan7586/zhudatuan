import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Listing } from '../model/Product';
import type { ProductAction } from '../model/ProductAction';
import { ProductDialog } from '../view/ProductDialog';
import { useProductActionViewModel } from './ProductActionViewModel';
import {
  OP_CATALOG_LISTINGS_PRICE_SET,
  OP_CATALOG_LISTINGS_PUBLISH,
  OP_CATALOG_LISTINGS_UNPUBLISH,
  OP_CATALOG_PRODUCTS_ARCHIVE,
  OP_CATALOG_PRODUCTS_CREATE,
  OP_CATALOG_PRODUCTS_UPDATE,
} from '@shop/contract/ids';
import { listingFixture } from '../test/ProductFixture';

afterEach(() => cleanup());

describe('ProductActionViewModel', () => {
  it('does not seed fake product data and resets fields when the selected action changes', async () => {
    const harness = setup({ operation: OP_CATALOG_PRODUCTS_CREATE });
    expect(screen.getByLabelText('商品名称')).toHaveProperty('value', '');
    expect(screen.getByLabelText('商品分类')).toHaveProperty('value', '');

    harness.rerender({ operation: OP_CATALOG_PRODUCTS_UPDATE, listing, status: 'active', expectedVersion: 7 });
    await waitFor(() => expect(screen.getByLabelText('商品名称')).toHaveProperty('value', '办公福利礼盒'));
    expect(screen.getByLabelText('商品分类')).toHaveProperty('value', 'category:office');
  });

  it('submits the authoritative product version and retains one identity for an unchanged payload', async () => {
    const execute = vi.fn().mockResolvedValue({ id: 'product:one', version: 8 });
    const done = vi.fn();
    setup({ operation: OP_CATALOG_PRODUCTS_UPDATE, listing, status: 'active', expectedVersion: 7 }, execute, done);
    await userEvent.setup().click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ identity: expect.stringMatching(/^command:/), accessVersion: 7 });
    expect(execute.mock.calls[0]?.[1]).toMatchObject({ operation: OP_CATALOG_PRODUCTS_UPDATE, listing, expectedVersion: 7, body: { title: '办公福利礼盒', category: 'category:office', status: 'active' } });
    expect(done).toHaveBeenCalledOnce();
  });

  it('creates a real product draft from the user-entered type, category and title', async () => {
    const execute = vi.fn().mockResolvedValue({ id: 'product:new', version: 1 });
    setup({ operation: OP_CATALOG_PRODUCTS_CREATE }, execute);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('商品名称'), '中秋员工礼盒');
    await user.type(screen.getByLabelText('商品分类'), 'category:festival');
    await user.selectOptions(screen.getByLabelText('商品类型'), 'voucher');
    await user.click(screen.getByRole('button', { name: '创建草稿' }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0]?.[1]).toEqual({
      operation: OP_CATALOG_PRODUCTS_CREATE,
      body: { title: '中秋员工礼盒', category: 'category:festival', type: 'voucher' },
    });
  });

  it('executes archive, publish and unpublish as distinct generated operations', async () => {
    const execute = vi.fn().mockResolvedValue({ version: 8 });
    const harness = setup({ operation: OP_CATALOG_PRODUCTS_ARCHIVE, listing, expectedVersion: 7 }, execute);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '确认归档' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    harness.rerender({ operation: OP_CATALOG_LISTINGS_PUBLISH, listing });
    await user.click(screen.getByRole('button', { name: '确认上架' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    harness.rerender({ operation: OP_CATALOG_LISTINGS_UNPUBLISH, listing });
    await user.click(screen.getByRole('button', { name: '确认下架' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(3));

    expect(execute.mock.calls.map((call) => call[1])).toEqual([
      { operation: OP_CATALOG_PRODUCTS_ARCHIVE, listing, expectedVersion: 7 },
      { operation: OP_CATALOG_LISTINGS_PUBLISH, listing },
      { operation: OP_CATALOG_LISTINGS_UNPUBLISH, listing },
    ]);
  });

  it('does not submit a generated operation that is absent from the current access snapshot', async () => {
    const execute = vi.fn();
    const denied = { ...context, session: { ...context.session, capabilities: [] } };
    setup({ operation: OP_CATALOG_PRODUCTS_ARCHIVE, listing, expectedVersion: 7 }, execute, vi.fn(), denied);
    const submit = screen.getByRole('button', { name: '确认归档' });

    expect(submit.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('当前账号不能执行这项商品操作。')).toBeTruthy();
    await userEvent.setup().click(submit);
    expect(execute).not.toHaveBeenCalled();
  });
});

function setup(initial: ProductAction, execute = vi.fn().mockResolvedValue({}), done = vi.fn(), value: ConsoleContext = context) {
  let sequence = 0;
  const dependencies = { executeAction: { execute }, createIdentity: () => `command:${++sequence}` } as unknown as ProductDependencies;
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness action={initial} context={value} dependencies={dependencies} done={done} />
    </QueryClientProvider>
  );
  return {
    rerender: (action: ProductAction) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <Harness action={action} context={value} dependencies={dependencies} done={done} />
        </QueryClientProvider>
      ),
  };
}

function Harness({ action, context: value, dependencies, done }: Readonly<{ action: ProductAction; context: ConsoleContext; dependencies: ProductDependencies; done: () => void }>) {
  return <ProductDialog viewmodel={useProductActionViewModel(action, value, dependencies, done)} onClose={() => undefined} />;
}

const listing: Listing = listingFixture();
const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', name: '华东福利商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 7,
    permissions: ['catalog.product.manage', 'catalog.listing.manage'],
    capabilities: [OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE, OP_CATALOG_PRODUCTS_ARCHIVE, OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_LISTINGS_PUBLISH, OP_CATALOG_LISTINGS_UNPUBLISH],
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
