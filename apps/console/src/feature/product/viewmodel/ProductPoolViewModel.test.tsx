import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Listing, Pool } from '../model/Product';
import { PoolDialog } from '../view/PoolDialog';
import { useProductPoolViewModel } from './ProductPoolViewModel';
import { listingFixture } from '../test/ProductFixture';
import {
  OP_CATALOG_LISTINGS_POOL_SET,
  OP_CATALOG_POOLS_ALLOCATE,
  OP_CATALOG_POOLS_ATTACH,
  OP_CATALOG_POOLS_DETACH,
  OP_CATALOG_POOLS_READ,
} from '@shop/contract/ids';

afterEach(() => cleanup());

describe('ProductPoolViewModel', () => {
  it('moves one unpublished listing with its current version and a stable retry identity', async () => {
    const move = vi.fn().mockRejectedValueOnce(new Error('网络暂时不可用')).mockResolvedValueOnce({ version: 4 });
    setup(listing, move);
    await screen.findByRole('button', { name: /目标渠道池/ });
    expect(screen.getByRole('button', { name: '确认执行' }).hasAttribute('disabled')).toBe(true);
    await userEvent.setup().click(screen.getByRole('button', { name: /目标渠道池/ }));
    await userEvent.setup().click(screen.getByRole('button', { name: '确认执行' }));
    await screen.findByText('服务暂时无法完成操作，请稍后重试。');
    await userEvent.setup().click(screen.getByRole('button', { name: '确认执行' }));

    await waitFor(() => expect(move).toHaveBeenCalledTimes(2));
    expect(move.mock.calls[0]?.[0].identity).toBe(move.mock.calls[1]?.[0].identity);
    expect(move.mock.calls[0]?.[1]).toBe(listing);
    expect(move.mock.calls[0]?.[2]).toMatchObject({ id: 'pool:target' });
  });

  it('removes the current pool without requiring a target selection', async () => {
    const move = vi.fn().mockResolvedValue({ version: 4 });
    setup(listing, move);
    await screen.findByRole('option', { name: '移出当前商品池' });
    await userEvent.setup().selectOptions(screen.getByLabelText('操作'), 'remove');
    await userEvent.setup().click(screen.getByRole('button', { name: '确认执行' }));
    await waitFor(() => expect(move).toHaveBeenCalledWith(expect.objectContaining({ identity: expect.stringMatching(/^command:/) }), listing, null));
  });

  it('allocates, attaches and detaches a pool through separate generated operations', async () => {
    const execute = vi.fn().mockResolvedValue({ version: 6 });
    setup(undefined, vi.fn(), execute, globalContext);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /当前商品池/ });
    await user.click(screen.getByRole('button', { name: '确认执行' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText('操作'), 'attach');
    await user.click(screen.getByRole('button', { name: '确认执行' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    await user.selectOptions(screen.getByLabelText('操作'), 'detach');
    await user.click(screen.getByRole('button', { name: '确认执行' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(3));

    expect(execute.mock.calls.map((call) => call[2])).toEqual([
      { operation: OP_CATALOG_POOLS_ALLOCATE, target: 'mall:one', poolkind: 'channel', name: '主打团渠道商品池' },
      { operation: OP_CATALOG_POOLS_ATTACH, target: 'mall:one' },
      { operation: OP_CATALOG_POOLS_DETACH, target: 'mall:one' },
    ]);
  });

  it('does not execute a listing pool change without the generated operation access', async () => {
    const move = vi.fn();
    const denied = { ...context, session: { ...context.session, capabilities: [OP_CATALOG_POOLS_READ] } };
    setup(listing, move, vi.fn(), denied);

    expect((await screen.findByRole('option', { name: '移入所选商品池' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('当前账号不能执行所选商品池操作。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认执行' }).hasAttribute('disabled')).toBe(true);
    expect(move).not.toHaveBeenCalled();
  });
});

function setup(current: Listing | undefined, move: ReturnType<typeof vi.fn>, execute = vi.fn(), value: ConsoleContext = context) {
  let sequence = 0;
  const dependencies = {
    readPools: { execute: vi.fn(async () => ({ items: pools, count: pools.length })) },
    changePool: { move, execute },
    createIdentity: () => `command:${++sequence}`,
  } as unknown as ProductDependencies;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness listing={current} context={value} dependencies={dependencies} />
    </QueryClientProvider>
  );
}

function Harness({ listing: current, context: value, dependencies }: Readonly<{ listing: Listing | undefined; context: ConsoleContext; dependencies: ProductDependencies }>) {
  const viewmodel = useProductPoolViewModel(true, current, value, dependencies, () => undefined);
  return <PoolDialog viewmodel={viewmodel} onClose={() => undefined} />;
}

const pools: readonly Pool[] = [
  { id: 'pool:current', kind: 'private', name: '当前商品池', status: 'active', version: 2, item_count: 3 },
  { id: 'pool:target', kind: 'channel', name: '目标渠道池', status: 'active', version: 5, item_count: 6 },
];
const listing: Listing = listingFixture({ pool_id: 'pool:current', status: 'unpublished' });
const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', name: '华东福利商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 7,
    permissions: ['catalog.pool.read', 'catalog.listing.manage'],
    capabilities: [OP_CATALOG_POOLS_READ, OP_CATALOG_LISTINGS_POOL_SET],
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
const globalContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    permissions: ['catalog.pool.read', 'catalog.pool.manage', 'catalog.pool.allocate'],
    capabilities: [OP_CATALOG_POOLS_READ, OP_CATALOG_POOLS_ALLOCATE, OP_CATALOG_POOLS_ATTACH, OP_CATALOG_POOLS_DETACH],
  },
};
