import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductImport } from '../model/ProductImport';
import { ProductImportDialog } from '../view/ProductImportDialog';
import { useProductImportViewModel } from './ProductImportViewModel';

afterEach(() => cleanup());

describe('ProductImportViewModel', () => {
  it('runs template, upload, mapping, server preflight, versioned confirmation and task receipt', async () => {
    const create = vi.fn<ProductDependencies['createImport']['execute']>(() => Promise.resolve(task('queued', 1)));
    const read = vi.fn(() => Promise.resolve({ ...task('ready', 2), total: 1, confirmationRequired: true, previewHash: 'b'.repeat(64), columns: ['sku', 'title'] }));
    const confirm = vi.fn(() => Promise.resolve({ ...task('running', 3), total: 1 }));
    setup(create, read, confirm);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '打开商品导入' }));
    expect(screen.getByRole('heading', { name: '导入商品' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '下一步：选择文件' }));
    const file = new File(['title,sku\n礼盒,SKU-1\n'], 'products.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('商品文件'), file);
    await user.click(screen.getByRole('button', { name: '下一步：核对映射' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '上传并开始服务端校验' }));

    expect(await screen.findByText('预检完成，等待确认')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认并执行导入' }));
    expect(await screen.findByText('商品导入正在执行')).toBeTruthy();
    expect(create.mock.calls[0]?.[0]).toHaveProperty('identity');
    expect(create).toHaveBeenCalledWith(expect.anything(), file, expect.any(Function));
    expect(confirm).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'import:one', version: 2, previewHash: 'b'.repeat(64) }));
    expect(read).toHaveBeenCalled();
  });

  it('keeps the entry disabled when any upload, catalog or task capability is absent', () => {
    setup(vi.fn(), vi.fn(), vi.fn(), { ...context, session: { ...context.session, capabilities: context.session.capabilities.filter((item) => item !== 'runtime.imports.confirm') } });
    expect(screen.getByRole('button', { name: '打开商品导入' }).hasAttribute('disabled')).toBe(true);
  });
});

function setup(create: ReturnType<typeof vi.fn>, read: ReturnType<typeof vi.fn>, confirm: ReturnType<typeof vi.fn>, value = context) {
  let sequence = 0;
  const dependencies = {
    createImport: { execute: create },
    readImport: { execute: read },
    confirmImport: { execute: confirm },
    importTemplate: { title: '商品', description: '校验商品字段。', columns: ['title', 'sku'] },
    createIdentity: () => `command:${++sequence}`,
  } as unknown as ProductDependencies;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Harness context={value} dependencies={dependencies} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function Harness({ context: value, dependencies }: Readonly<{ context: ConsoleContext; dependencies: ProductDependencies }>) {
  const model = useProductImportViewModel(value, dependencies, () => undefined);
  return (
    <>
      <button type="button" onClick={model.actions.open} disabled={!model.canOpen}>
        打开商品导入
      </button>
      <ProductImportDialog viewmodel={model} />
    </>
  );
}

function task(state: ProductImport['state'], version: number): ProductImport {
  return {
    id: 'import:one',
    type: 'import',
    owner: 'catalog',
    kind: 'product',
    title: '商品导入',
    state,
    processed: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    retryableItems: 0,
    cancellable: true,
    retryable: false,
    version,
    createdAt: '2026-09-07T08:00:00.000Z',
    updatedAt: '2026-09-07T08:00:00.000Z',
    expiresAt: '2026-09-08T08:00:00.000Z',
    fileName: 'products.csv',
    downloadAvailable: false,
    confirmationRequired: false,
    previewHash: null,
    columns: [],
    validationErrors: 0,
    last_error: null,
    errors: [],
  };
}

const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', name: '华东福利商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 7,
    permissions: ['runtime.import.manage', 'runtime.task.read', 'catalog.import.manage'],
    capabilities: ['runtime.uploads.create', 'runtime.imports.read', 'runtime.imports.confirm', 'catalog.imports.create'],
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
