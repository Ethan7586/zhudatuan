import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { allocatePool, archiveProduct, createProduct, publishPrice, setListingPublication, setPoolBinding, updateProduct } from './ProductCommand';
import { poolKey, readPools } from './ProductQuery';
import type { ProductStatus } from './ProductPublication';
import type { Listing, Pool } from './ProductSchema';

export type ProductAction =
  | Readonly<{ kind: 'create' }>
  | Readonly<{ kind: 'edit'; listing: Listing; status: ProductStatus }>
  | Readonly<{ kind: 'archive' | 'price' | 'publish' | 'unpublish'; listing: Listing }>;

export function ProductActionDialog({ action, context, onClose, onDone }: Readonly<{ action: ProductAction | null; context: ConsoleContext; onClose: () => void; onDone: () => void }>) {
  if (action === null) return null;
  return <ProductActionForm key={`${action.kind}:${'listing' in action ? action.listing.id : 'new'}`} action={action} context={context} onClose={onClose} onDone={onDone} />;
}

function ProductActionForm({ action, context, onClose, onDone }: Readonly<{ action: ProductAction; context: ConsoleContext; onClose: () => void; onDone: () => void }>) {
  const listing = 'listing' in action ? action.listing : undefined;
  const [title, setTitle] = useState(listing?.title ?? '主打团臻选员工福利礼盒');
  const [category, setCategory] = useState('企业福利专区');
  const [type, setType] = useState<'physical' | 'virtual' | 'service' | 'voucher'>('physical');
  const [status, setStatus] = useState<ProductStatus>(action.kind === 'edit' ? action.status : 'active');
  const [amount, setAmount] = useState('99.00');
  const mutation = useMutation({
    mutationFn: async () => {
      if (action.kind === 'create') return createProduct(context, { title, category, type });
      if (action.kind === 'edit') return updateProduct(context, action.listing, { title, category, status });
      if (action.kind === 'archive') return archiveProduct(context, action.listing);
      if (action.kind === 'price') return publishPrice(context, action.listing, priceMinor(amount));
      return setListingPublication(context, action.listing, action.kind === 'publish');
    },
    onSuccess: onDone,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };
  return (
    <div className="productflowoverlay">
      <button className="productflowbackdrop" type="button" onClick={onClose} aria-label="关闭商品操作窗口" />
      <form className="productflowdialog" aria-label={actionTitle(action.kind)} onSubmit={submit}>
        <header>
          <div>
            <p>CATALOG COMMAND</p>
            <h2>{actionTitle(action.kind)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭商品操作窗口">
            ×
          </button>
        </header>
        <div className="productflowbody">
          {action.kind === 'create' || action.kind === 'edit' ? (
            <>
              <label>
                商品名称
                <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} />
              </label>
              <label>
                商品分类
                <input value={category} onChange={(event) => setCategory(event.target.value)} required maxLength={120} />
              </label>
              {action.kind === 'create' ? (
                <label>
                  商品类型
                  <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                    <option value="physical">实物商品</option>
                    <option value="virtual">虚拟商品</option>
                    <option value="service">服务商品</option>
                    <option value="voucher">卡券商品</option>
                  </select>
                </label>
              ) : null}
              {action.kind === 'edit' ? (
                <label>
                  商品状态
                  <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                    <option value="draft">草稿</option>
                    <option value="review">待审核</option>
                    <option value="active">启用</option>
                    <option value="archived">归档</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
          {action.kind === 'price' ? (
            <label>
              销售价（元）
              <input type="number" min="0.01" max="999999.99" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
          ) : null}
          {action.kind === 'archive' ? <p>归档商品“{action.listing.title}”后将不可继续销售；历史订单保持不变。</p> : null}
          {action.kind === 'publish' || action.kind === 'unpublish' ? (
            <p>
              确认{action.kind === 'publish' ? '上架' : '下架'}“{action.listing.title}”？该操作使用当前列表版本进行并发校验。
            </p>
          ) : null}
          {action.kind === 'create' ? <p className="productflownote">商品先以草稿创建；SKU 与商品池投放由后续独立流程完成。</p> : null}
          {mutation.error === null ? null : (
            <p role="alert" className="productflowerror">
              {mutation.error.message}
            </p>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="productactionprimary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '正在提交…' : actionSubmit(action.kind)}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function PoolDialog({ open, context, onClose, onDone }: Readonly<{ open: boolean; context: ConsoleContext; onClose: () => void; onDone: () => void }>) {
  const query = useQuery({ queryKey: poolKey(context), queryFn: ({ signal }) => readPools(context, signal), enabled: open, staleTime: 60_000 });
  const pools = query.data?.items ?? [];
  const malls = useMemo(() => context.scopes.filter((scope) => scope.kind === 'mall' && isVisibleMall(context, scope)), [context]);
  const [selectedId, setSelectedId] = useState('');
  const [targetScope, setTargetScope] = useState('');
  const [kind, setKind] = useState<'channel' | 'markup'>('channel');
  const [name, setName] = useState('主打团渠道商品池');
  const [operation, setOperation] = useState<'allocate' | 'attach' | 'detach'>('allocate');
  const selected = pools.find((pool) => pool.id === selectedId) ?? pools[0];
  const target = targetScope || malls[0]?.id || context.scope.id;
  const mutation = useMutation({
    mutationFn: async () => {
      if (selected === undefined) throw new Error('请先选择来源商品池');
      if (operation === 'allocate') return allocatePool(context, selected, target, kind, name);
      return setPoolBinding(context, selected, target, operation === 'attach');
    },
    onSuccess: () => {
      void query.refetch();
      onDone();
    },
  });
  if (!open) return null;
  return (
    <div className="productflowoverlay">
      <button className="productflowbackdrop" type="button" onClick={onClose} aria-label="关闭商品池窗口" />
      <form
        className="productflowdialog productpooldialog"
        aria-label="商品池管理"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <header>
          <div>
            <p>POOL GOVERNANCE</p>
            <h2>商品池管理</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭商品池窗口">
            ×
          </button>
        </header>
        <div className="productflowbody">
          <section className="productpoolsummary" aria-label="当前商品池">
            {query.isPending ? <p>正在读取商品池…</p> : pools.map((pool) => <PoolCard key={pool.id} pool={pool} selected={selected?.id === pool.id} onSelect={setSelectedId} />)}
          </section>
          <label>
            操作
            <select value={operation} onChange={(event) => setOperation(event.target.value as typeof operation)}>
              <option value="allocate">派生商品池</option>
              <option value="attach">绑定到商城</option>
              <option value="detach">从商城解绑</option>
            </select>
          </label>
          <label>
            目标商城
            <select value={target} onChange={(event) => setTargetScope(event.target.value)}>
              {malls.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name ?? scope.id}
                </option>
              ))}
              {malls.length === 0 ? <option value={context.scope.id}>{context.scope.name ?? context.scope.id}</option> : null}
            </select>
          </label>
          {operation === 'allocate' ? (
            <>
              <label>
                派生类型
                <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                  <option value="channel">渠道商品池</option>
                  <option value="markup">加价商品池</option>
                </select>
              </label>
              <label>
                商品池名称
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
              </label>
            </>
          ) : null}
          <p className="productflownote">全局池、私有池作为来源；渠道池、加价池可从选中来源池复制商品项并独立绑定商城。</p>
          {query.error === null && mutation.error === null ? null : (
            <p role="alert" className="productflowerror">
              {mutation.error?.message ?? query.error?.message}
            </p>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            关闭
          </button>
          <button className="productactionprimary" type="submit" disabled={selected === undefined || mutation.isPending}>
            {mutation.isPending ? '正在执行…' : '确认执行'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function PoolCard({ pool, selected, onSelect }: Readonly<{ pool: Pool; selected: boolean; onSelect: (id: string) => void }>) {
  return (
    <button type="button" aria-pressed={selected} onClick={() => onSelect(pool.id)}>
      <strong>{pool.name}</strong>
      <span>
        {poolKind(pool.kind)} · {pool.item_count} 件 · v{pool.version}
      </span>
    </button>
  );
}

function poolKind(kind: string): string {
  return { global: '全局池', channel: '渠道池', private: '私有池', markup: '加价池' }[kind] ?? kind;
}

function isVisibleMall(context: ConsoleContext, scope: ConsoleContext['scopes'][number]): boolean {
  if (context.scope.kind === 'platform' || scope.id === context.scope.id) return true;
  if (scope.path?.some((part) => part.id === context.scope.id) === true) return true;
  const scopeName = context.scope.name?.trim();
  if (scopeName !== undefined && scopeName !== '' && scope.name?.startsWith(scopeName) === true) return true;
  const scopeKey = context.scope.id.split(/[:-]/).slice(1).join('-');
  return scopeKey !== '' && scope.id.endsWith(scopeKey);
}

function actionTitle(kind: ProductAction['kind']): string {
  return { create: '新建商品', edit: '编辑商品', archive: '归档商品', price: '设置销售价', publish: '上架商品', unpublish: '下架商品' }[kind];
}

function actionSubmit(kind: ProductAction['kind']): string {
  return { create: '创建草稿', edit: '保存修改', archive: '确认归档', price: '创建并发布价格', publish: '确认上架', unpublish: '确认下架' }[kind];
}

function priceMinor(value: string): number {
  const parsed = Number(value);
  const minor = Math.round(parsed * 100);
  if (!Number.isFinite(parsed) || minor <= 0 || minor > 99_999_999) throw new Error('销售价必须介于 0.01 与 999999.99 元之间');
  return minor;
}
