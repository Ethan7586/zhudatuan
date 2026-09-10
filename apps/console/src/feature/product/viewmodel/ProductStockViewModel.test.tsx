import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { listingFixture } from '../test/ProductFixture';
import { useProductStockViewModel } from './ProductStockViewModel';
import { ProductStockDialog } from '../view/ProductStockDialog';

afterEach(cleanup);

describe('ProductStockViewModel', () => {
  it('opens a direct restock form without asking the operator for a file', async () => {
    const execute = vi.fn(async (_context, input, progress) => {
      progress?.('uploading');
      progress?.('validating');
      progress?.('applying');
      progress?.('completed');
      return { state: 'completed' };
    });
    renderHarness(dependencies(execute));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '打开补充库存' }));
    expect(await screen.findByRole('dialog', { name: '补充库存' })).toBeTruthy();
    expect(screen.queryByLabelText(/文件/)).toBeNull();
    expect(screen.getByText('当前现货').parentElement?.textContent).toContain('12');
    expect(screen.getByText('入库后现货').parentElement?.textContent).toContain('22');

    const quantity = screen.getByRole('spinbutton', { name: /本次增加数量/ });
    await user.clear(quantity);
    await user.type(quantity, '5');
    expect(screen.getByText('入库后现货').parentElement?.textContent).toContain('17');
    await user.click(screen.getByRole('button', { name: '确认补充库存' }));

    await waitFor(() => expect(execute).toHaveBeenCalledWith(context, expect.objectContaining({ sku: 'sku:one', location: 'warehouse:main', currentOnhand: 12, quantity: 5, safety: 2 }), expect.any(Function), expect.any(AbortSignal)));
    expect(await screen.findByText('库存已补充，商品数据正在刷新。')).toBeTruthy();
  });

  it('preserves the operator input when live stock data refreshes', async () => {
    const valueDependencies = dependencies(vi.fn());
    const { client } = renderHarness(valueDependencies);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '打开补充库存' }));
    const safety = await screen.findByRole('spinbutton', { name: /安全库存/ });
    await user.clear(safety);
    await user.type(safety, '7');
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['console'] });
    });

    await waitFor(() => expect(valueDependencies.readStock.execute).toHaveBeenCalledTimes(2));
    expect((safety as HTMLInputElement).value).toBe('7');
  });

  it('keeps the direct action blocked when the account lacks one required capability', async () => {
    renderHarness(dependencies(vi.fn()), { ...context, session: { ...context.session, capabilities: context.session.capabilities.filter((value) => value !== 'runtime.imports.confirm') } });
    await userEvent.setup().click(screen.getByRole('button', { name: '打开补充库存' }));
    expect(screen.queryByRole('dialog', { name: '补充库存' })).toBeNull();
  });
});

function Harness({ value, dependencies: valueDependencies }: Readonly<{ value: ConsoleContext; dependencies: ProductDependencies }>) {
  const viewmodel = useProductStockViewModel(value, valueDependencies, vi.fn(), vi.fn());
  return (
    <>
      <button type="button" onClick={() => viewmodel.actions.open(listingFixture())}>
        打开补充库存
      </button>
      <ProductStockDialog viewmodel={viewmodel} />
    </>
  );
}

function renderHarness(valueDependencies: ProductDependencies, value = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Harness value={value} dependencies={valueDependencies} />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...result, client };
}

function dependencies(execute: ReturnType<typeof vi.fn>): ProductDependencies {
  return {
    readStock: {
      execute: vi.fn(async () => ({
        items: [
          {
            sku: 'sku:one',
            scope: 'mall:one',
            onhand: 12,
            safety: 2,
            reserved: 1,
            available: 9,
            state: 'available',
            reservation: { activeCount: 1, activeQuantity: 1, earliestExpiry: null },
            sources: [{ id: 'stock:one', source: 'self', reference: null, location: 'warehouse:main', onhand: 12, safety: 2, reserved: 1, available: 9, state: 'active', version: '2', watermark: '2026-09-10T00:00:00.000Z' }],
            version: '2',
            watermark: '2026-09-10T00:00:00.000Z',
          },
        ],
        count: 1,
        watermark: '2026-09-10T00:00:00.000Z',
      })),
    },
    restock: { execute },
  } as unknown as ProductDependencies;
}

const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one' } as const;
const context = {
  scope,
  scopes: [scope],
  profile: { display_name: '测试用户', employee_no: null },
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 1,
    permissions: ['inventory.read', 'inventory.import.manage', 'runtime.import.manage', 'runtime.task.read'],
    capabilities: ['inventory.availability.read', 'inventory.imports.create', 'runtime.uploads.create', 'runtime.imports.read', 'runtime.imports.confirm'],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    target: 'console',
    csrf: 'csrf:one',
    syncedAt: '2026-09-10T00:00:00.000Z',
  },
} satisfies ConsoleContext;
