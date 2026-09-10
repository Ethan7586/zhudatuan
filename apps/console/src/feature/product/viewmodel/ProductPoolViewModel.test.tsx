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
import { OP_CATALOG_LISTINGS_POOL_SET, OP_CATALOG_POOLS_ALLOCATE, OP_CATALOG_POOLS_ATTACH, OP_CATALOG_POOLS_DETACH, OP_CATALOG_POOLS_READ } from '@shop/contract/ids';

afterEach(() => cleanup());

describe('ProductPoolViewModel', () => {
  it('moves one unpublished listing with its current version and a stable retry identity', async () => {
    const move = vi.fn().mockRejectedValueOnce(new Error('网络暂时不可用')).mockResolvedValueOnce({ version: 4 });
    setup(listing, move);
    await screen.findByRole('button', { name: /目标渠道池/ });
    expect(screen.getByRole('button', { name: '确认移入' }).hasAttribute('disabled')).toBe(true);
    await userEvent.setup().click(screen.getByRole('button', { name: /目标渠道池/ }));
    expect(screen.getByText(/将移入“目标渠道池”/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '确认移入' }));
    await screen.findByText('服务暂时无法完成操作，请稍后重试。');
    await userEvent.setup().click(screen.getByRole('button', { name: '确认移入' }));

    await waitFor(() => expect(move).toHaveBeenCalledTimes(2));
    expect(commandIdentity(move.mock.calls[0]?.[0])).toBe(commandIdentity(move.mock.calls[1]?.[0]));
    expect(move.mock.calls[0]?.[1]).toBe(listing);
    expect(move.mock.calls[0]?.[2]).toMatchObject({ id: 'pool:target' });
  });

  it('removes the current pool without requiring a target selection', async () => {
    const move = vi.fn().mockResolvedValue({ version: 4 });
    setup(listing, move);
    await screen.findByRole('radio', { name: /移出当前商品池/ });
    await userEvent.setup().click(screen.getByRole('radio', { name: /移出当前商品池/ }));
    expect(screen.getByText(/将移出“当前商品池”/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '确认移出' }));
    await waitFor(() => expect(move).toHaveBeenCalledTimes(1));
    expect(commandIdentity(move.mock.calls[0]?.[0])).toMatch(/^command:/);
    expect(move).toHaveBeenCalledWith(expect.anything(), listing, null);
  });

  it('allocates, attaches and detaches a pool through separate generated operations', async () => {
    const execute = vi.fn().mockResolvedValue({ version: 6 });
    setup(undefined, vi.fn(), execute, globalContext);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /当前商品池/ });
    expect(screen.getByText(/将在“华东福利商城”创建“主打团渠道商品池”/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '创建派生池' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('radio', { name: /投放到商城/ }));
    await user.click(screen.getByRole('button', { name: '确认投放' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('radio', { name: /停止商城投放/ }));
    await user.click(screen.getByRole('button', { name: '停止投放' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(3));

    expect(execute).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything(), { operation: OP_CATALOG_POOLS_ALLOCATE, target: 'mall:one', poolkind: 'channel', name: '主打团渠道商品池' });
    expect(execute).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), { operation: OP_CATALOG_POOLS_ATTACH, target: 'mall:one' });
    expect(execute).toHaveBeenNthCalledWith(3, expect.anything(), expect.anything(), { operation: OP_CATALOG_POOLS_DETACH, target: 'mall:one' });
  });

  it('discovers governed malls from the organization catalog instead of treating the enterprise as a mall', async () => {
    setup(undefined, vi.fn(), vi.fn(), enterpriseContext, [enterpriseScope, governedMall, unrelatedMall]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: /投放到商城/ }));

    const target = await screen.findByLabelText('3. 目标商城');
    expect((target as HTMLSelectElement).value).toBe('mall:governed');
    expect(target.querySelectorAll('option')).toHaveLength(1);
    expect(target.textContent).toBe('主打团福利商城');
  });

  it('offers only pools owned by the current business scope as allocation sources', async () => {
    const enterprisePool: Pool = { ...pools[0]!, id: 'pool:enterprise', scope_id: enterpriseScope.id, name: '集团总池' };
    const mallPool: Pool = { ...pools[1]!, id: 'pool:mall', scope_id: governedMall.id, name: '商城自有池' };
    setup(undefined, vi.fn(), vi.fn(), enterpriseContext, enterpriseContext.scopes, undefined, vi.fn(), [mallPool, enterprisePool]);

    expect(await screen.findByRole('button', { name: /集团总池/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /商城自有池/ })).toBeNull();
    expect(screen.getByText(/将在“主打团”创建“主打团渠道商品池”/)).toBeTruthy();
  });

  it('continues one product from its current pool to mall delivery without asking the operator to choose the task or pool again', async () => {
    const execute = vi.fn().mockResolvedValue({ version: 6 });
    setup(listing, vi.fn(), execute, deliveryContext, deliveryContext.scopes, 'deliver');

    expect(await screen.findByLabelText('1. 选择投放商城')).toHaveProperty('value', 'mall:one');
    expect(screen.queryByRole('radiogroup', { name: '商品池任务' })).toBeNull();
    expect(screen.getByText(/将随“当前商品池”投放到“华东福利商城”/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '投放到商城' }));

    await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.anything(), pools[0], { operation: OP_CATALOG_POOLS_ATTACH, target: 'mall:one' }));
  });

  it('does not execute a listing pool change without the generated operation access', async () => {
    const move = vi.fn();
    const denied = { ...context, session: { ...context.session, capabilities: [OP_CATALOG_POOLS_READ] } };
    setup(listing, move, vi.fn(), denied);

    expect((await screen.findByRole('radio', { name: /移入其他商品池/ })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('当前账号不能执行所选商品池操作。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认移入' }).hasAttribute('disabled')).toBe(true);
    expect(move).not.toHaveBeenCalled();
  });

  it('requests fresh identity verification before a high-assurance pool operation', async () => {
    const execute = vi.fn();
    const requestStepup = vi.fn();
    const lowAssurance = { ...globalContext, session: { ...globalContext.session, assurance: { level: 1 as const } } };
    setup(undefined, vi.fn(), execute, lowAssurance, lowAssurance.scopes, undefined, requestStepup);

    await userEvent.setup().click(await screen.findByRole('button', { name: '创建派生池' }));

    expect(requestStepup).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });
});

function setup(current: Listing | undefined, move: ReturnType<typeof vi.fn>, execute = vi.fn(), value: ConsoleContext = context, targets = value.scopes, intent?: 'deliver', requestStepup = vi.fn(), poolValues: readonly Pool[] = pools) {
  let sequence = 0;
  const dependencies = {
    readPools: { execute: vi.fn(() => Promise.resolve({ items: poolValues, count: poolValues.length })) },
    readPoolTargets: { execute: vi.fn(() => Promise.resolve(targets)) },
    changePool: { move, execute },
    createIdentity: () => `command:${++sequence}`,
  } as unknown as ProductDependencies;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness listing={current} context={value} dependencies={dependencies} requestStepup={requestStepup} {...(intent === undefined ? {} : { intent })} />
    </QueryClientProvider>
  );
}

function commandIdentity(value: unknown): string {
  if (value === null || typeof value !== 'object') throw new Error('TEST_COMMAND_MISSING');
  const identity: unknown = Reflect.get(value, 'identity');
  if (typeof identity !== 'string') throw new Error('TEST_COMMAND_IDENTITY_MISSING');
  return identity;
}

function Harness({
  listing: current,
  context: value,
  dependencies,
  requestStepup,
  intent,
}: Readonly<{ listing: Listing | undefined; context: ConsoleContext; dependencies: ProductDependencies; requestStepup: () => void; intent?: 'deliver' }>) {
  const viewmodel = useProductPoolViewModel(true, current, value, dependencies, requestStepup, () => undefined, intent);
  return <PoolDialog viewmodel={viewmodel} onClose={() => undefined} />;
}

const pools: readonly Pool[] = [
  { id: 'pool:current', scope_id: 'mall:one', kind: 'private', name: '当前商品池', status: 'active', version: 2, item_count: 3 },
  { id: 'pool:target', scope_id: 'mall:one', kind: 'channel', name: '目标渠道池', status: 'active', version: 5, item_count: 6 },
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
const deliveryContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    permissions: ['catalog.pool.read', 'catalog.pool.manage'],
    capabilities: [OP_CATALOG_POOLS_READ, OP_CATALOG_POOLS_ATTACH],
  },
};
const enterpriseScope = { kind: 'enterprise', id: 'enterprise:governed', tenant: 'tenant:one', name: '主打团' } as const;
const governedMall = { kind: 'mall', id: 'mall:governed', parent_id: enterpriseScope.id, name: '主打团福利商城', status: 'active', timezone: 'Asia/Shanghai', version: 1 } as const;
const unrelatedMall = { kind: 'mall', id: 'mall:unrelated', parent_id: 'enterprise:other', name: '其他商城', status: 'active', timezone: 'Asia/Shanghai', version: 1 } as const;
const enterpriseContext: ConsoleContext = {
  ...context,
  scope: enterpriseScope,
  scopes: [enterpriseScope],
  session: {
    ...context.session,
    scope: enterpriseScope,
    scopes: [enterpriseScope],
    permissions: ['catalog.pool.read', 'catalog.pool.manage', 'catalog.pool.allocate', 'organization.layer.read'],
    capabilities: [OP_CATALOG_POOLS_READ, OP_CATALOG_POOLS_ALLOCATE, OP_CATALOG_POOLS_ATTACH, OP_CATALOG_POOLS_DETACH, 'organization.layers.read'],
  },
};
