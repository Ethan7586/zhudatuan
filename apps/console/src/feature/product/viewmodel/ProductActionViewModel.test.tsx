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
  OP_CATALOG_MEDIAUPLOADS_CREATE,
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
    expect(execute.mock.calls[0]?.[0]).toHaveProperty('accessVersion', 7);
    expect(execute.mock.calls[0]?.[0]).toHaveProperty('identity');
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

  it('uploads a selected image before saving and reuses the OSS receipt after a save failure', async () => {
    const receipt = {
      reference: 'object:cover',
      path: 'tenant/owner/asset/2030/01/01/cover.png',
      sha256: 'a'.repeat(64),
      size: 8,
      contentType: 'image/png' as const,
      retentionUntil: '2030-12-31T00:00:00.000Z',
    };
    const execute = vi.fn().mockRejectedValueOnce(new Error('保存暂时失败')).mockResolvedValueOnce({ id: 'product:new', version: 1 });
    const upload = vi.fn(async (_request, file: File, _signal, progress) => {
      progress?.({ stage: 'checking', processed: file.size, total: file.size });
      progress?.({ stage: 'uploading', processed: file.size, total: file.size });
      return receipt;
    });
    const harness = setup({ operation: OP_CATALOG_PRODUCTS_CREATE }, execute, vi.fn(), context, upload);
    const user = userEvent.setup();
    const file = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], '节日礼盒.png', { type: 'image/png', lastModified: 1 });
    await user.type(screen.getByLabelText('商品名称'), '中秋员工礼盒');
    await user.type(screen.getByLabelText('商品分类'), 'category:festival');
    await user.upload(screen.getByLabelText('选择商品图片'), file);
    expect(screen.getByText('已选择：节日礼盒.png')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '创建草稿' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('图片已保留，无需重新选择，可直接重试'));
    await user.click(screen.getByRole('button', { name: '创建草稿' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));

    expect(upload).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenLastCalledWith(expect.anything(), {
      operation: OP_CATALOG_PRODUCTS_CREATE,
      body: { title: '中秋员工礼盒', category: 'category:festival', type: 'physical', image: receipt },
    });
    expect(harness.upload).toBe(upload);
  });

  it('keeps the selected image after an upload failure and uploads it again on retry', async () => {
    const receipt = {
      reference: 'object:cover',
      path: 'tenant/owner/asset/2030/01/01/cover.png',
      sha256: 'a'.repeat(64),
      size: 8,
      contentType: 'image/png' as const,
      retentionUntil: '2030-12-31T00:00:00.000Z',
    };
    const execute = vi.fn().mockResolvedValue({ id: 'product:new', version: 1 });
    const upload = vi.fn().mockRejectedValueOnce(new Error('UPLOAD_FAILED')).mockResolvedValueOnce(receipt);
    setup({ operation: OP_CATALOG_PRODUCTS_CREATE }, execute, vi.fn(), context, upload);
    const user = userEvent.setup();
    const file = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], '节日礼盒.png', { type: 'image/png', lastModified: 1 });
    await user.type(screen.getByLabelText('商品名称'), '中秋员工礼盒');
    await user.type(screen.getByLabelText('商品分类'), 'category:festival');
    await user.upload(screen.getByLabelText('选择商品图片'), file);

    await user.click(screen.getByRole('button', { name: '创建草稿' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('图片已保留，无需重新选择，可直接重试'));
    expect(screen.getByText('已选择：节日礼盒.png')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '创建草稿' }));

    await waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(upload).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledWith(expect.anything(), {
      operation: OP_CATALOG_PRODUCTS_CREATE,
      body: { title: '中秋员工礼盒', category: 'category:festival', type: 'physical', image: receipt },
    });
  });

  it('removes an existing product image only after the user saves the edit', async () => {
    const execute = vi.fn().mockResolvedValue({ id: 'product:one', version: 8 });
    setup({ operation: OP_CATALOG_PRODUCTS_UPDATE, listing: listingFixture({ cover_url: 'https://objects.test/current.png' }), status: 'active', expectedVersion: 7 }, execute);
    const user = userEvent.setup();

    expect(screen.getByAltText('办公福利礼盒当前图片')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '移除图片' }));
    expect(screen.getByText('保存后移除当前图片')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ body: expect.objectContaining({ image: null }) })));
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

    expect(execute).toHaveBeenNthCalledWith(1, expect.anything(), { operation: OP_CATALOG_PRODUCTS_ARCHIVE, listing, expectedVersion: 7 });
    expect(execute).toHaveBeenNthCalledWith(2, expect.anything(), { operation: OP_CATALOG_LISTINGS_PUBLISH, listing });
    expect(execute).toHaveBeenNthCalledWith(3, expect.anything(), { operation: OP_CATALOG_LISTINGS_UNPUBLISH, listing });
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

  it('requests identity verification before an operation whose assurance is not yet sufficient', async () => {
    const execute = vi.fn();
    const requestStepup = vi.fn();
    const passwordContext = { ...context, session: { ...context.session, assurance: { level: 1 } } };
    setup({ operation: OP_CATALOG_PRODUCTS_CREATE }, execute, vi.fn(), passwordContext, vi.fn(), requestStepup);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('商品名称'), '中秋员工礼盒');
    await user.type(screen.getByLabelText('商品分类'), 'category:festival');
    await user.click(screen.getByRole('button', { name: '创建草稿' }));

    expect(requestStepup).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });
});

function setup(initial: ProductAction, execute = vi.fn().mockResolvedValue({}), done = vi.fn(), value: ConsoleContext = context, upload = vi.fn().mockResolvedValue({}), requestStepup = vi.fn()) {
  let sequence = 0;
  const dependencies = { executeAction: { execute }, uploadImage: { execute: upload }, createIdentity: () => `command:${++sequence}` } as unknown as ProductDependencies;
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness action={initial} context={value} dependencies={dependencies} requestStepup={requestStepup} done={done} />
    </QueryClientProvider>
  );
  return {
    upload,
    rerender: (action: ProductAction) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <Harness action={action} context={value} dependencies={dependencies} requestStepup={requestStepup} done={done} />
        </QueryClientProvider>
      ),
  };
}

function Harness({ action, context: value, dependencies, requestStepup, done }: Readonly<{ action: ProductAction; context: ConsoleContext; dependencies: ProductDependencies; requestStepup: () => void; done: () => void }>) {
  return <ProductDialog viewmodel={useProductActionViewModel(action, value, dependencies, requestStepup, done)} onClose={() => undefined} />;
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
    capabilities: [OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE, OP_CATALOG_PRODUCTS_ARCHIVE, OP_CATALOG_MEDIAUPLOADS_CREATE, OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_LISTINGS_PUBLISH, OP_CATALOG_LISTINGS_UNPUBLISH],
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
