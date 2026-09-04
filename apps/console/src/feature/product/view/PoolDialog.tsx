import { chineseReference, presentProductPoolKind } from '@shop/presentation';
import type { ProductPoolViewModel } from '../viewmodel/ProductPoolViewModel';
import type { Pool } from '../model/Product';
import { isManagedListing } from '../model/ProductAction';

export function PoolDialog({ viewmodel, onClose }: Readonly<{ viewmodel: ProductPoolViewModel; onClose: () => void }>) {
  if (!viewmodel.open) return null;
  const listingMode = viewmodel.listing !== undefined;
  const listingPool = viewmodel.listing !== undefined && isManagedListing(viewmodel.listing) ? viewmodel.listing.pool_id : null;
  return (
    <div className="productflowoverlay">
      <button className="productflowbackdrop" type="button" onClick={onClose} aria-label="关闭商品池窗口" />
      <form
        className="productflowdialog productpooldialog"
        aria-label={listingMode ? '商品投池' : '商品池管理'}
        onSubmit={(event) => {
          event.preventDefault();
          viewmodel.submit();
        }}
      >
        <header>
          <div>
            <p>{listingMode ? '商品投放' : '商品池治理'}</p>
            <h2>{listingMode ? '商品投池' : '商品池管理'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭商品池窗口">
            ×
          </button>
        </header>
        <div className="productflowbody">
          {viewmodel.listing === undefined ? null : (
            <section className="productpoolcontext" aria-label="当前商品">
              <span>当前商品</span>
              <strong>{viewmodel.listing.title}</strong>
              <small>{listingPool ? `当前已进入${chineseReference('商品池', listingPool)}` : '当前尚未进入商品池'}</small>
            </section>
          )}
          <section className="productpoolsummary" aria-label={listingMode ? '可选商品池' : '当前商品池'}>
            {viewmodel.loading ? (
              <p>正在读取商品池…</p>
            ) : viewmodel.pools.length === 0 ? (
              <p>当前范围暂无可用商品池。</p>
            ) : (
              viewmodel.pools.map((pool) => <PoolCard key={pool.id} pool={pool} selected={viewmodel.selected?.id === pool.id} onSelect={viewmodel.select} />)
            )}
          </section>
          <label>
            操作
            <select value={viewmodel.operation} onChange={(event) => viewmodel.setOperation(event.target.value as ProductPoolViewModel['operation'])}>
              {listingMode ? (
                <>
                  <option value="move" disabled={!viewmodel.canMode('move')}>移入所选商品池</option>
                  <option value="remove" disabled={listingPool === null || !viewmodel.canMode('remove')}>
                    移出当前商品池
                  </option>
                </>
              ) : (
                <>
                  <option value="allocate" disabled={!viewmodel.canMode('allocate')}>派生商品池</option>
                  <option value="attach" disabled={!viewmodel.canMode('attach')}>将商品池投放到商城</option>
                  <option value="detach" disabled={!viewmodel.canMode('detach')}>停止商品池投放</option>
                </>
              )}
            </select>
          </label>
          {listingMode ? null : (
            <label>
              目标商城
              <select value={viewmodel.target} onChange={(event) => viewmodel.setTarget(event.target.value)}>
                {viewmodel.malls.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.name ?? chineseReference('组织范围', scope.id)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {viewmodel.operation === 'allocate' ? (
            <>
              <label>
                派生类型
                <select value={viewmodel.kind} onChange={(event) => viewmodel.setKind(event.target.value as ProductPoolViewModel['kind'])}>
                  <option value="channel">渠道商品池</option>
                  <option value="markup">加价商品池</option>
                </select>
              </label>
              <label>
                商品池名称
                <input value={viewmodel.name} onChange={(event) => viewmodel.setName(event.target.value)} required maxLength={120} />
              </label>
            </>
          ) : null}
          <p className="productflownote">
            {listingMode
              ? viewmodel.operation === 'remove'
                ? '移出后，该商城上架记录不再关联商品池；如需恢复销售，请重新选择可用商品池后上架。'
                : '选择目标商品池后提交；已上架商品需要先下架，系统会用当前版本防止覆盖他人的并发修改。'
              : '全局池、私有池作为来源；渠道池、加价池可从选中来源池复制商品项并独立投放到商城。'}
          </p>
          {viewmodel.error === undefined ? null : (
            <p role="alert" className="productflowerror">
              {viewmodel.error}
            </p>
          )}
          {viewmodel.permissionReason === undefined ? null : (
            <p role="alert" className="productflowerror">
              {viewmodel.permissionReason}
            </p>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            关闭
          </button>
          <button className="productactionprimary" type="submit" disabled={!viewmodel.canSubmit || viewmodel.submitting} title={viewmodel.permissionReason}>
            {viewmodel.submitting ? '正在执行…' : '确认执行'}
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
        {presentProductPoolKind(pool.kind)} · {pool.item_count} 件 · 第 {pool.version} 版
      </span>
    </button>
  );
}
