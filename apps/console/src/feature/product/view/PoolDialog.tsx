import { chineseReference } from '@shop/presentation';
import type { ProductPoolViewModel } from '../viewmodel/ProductPoolViewModel';
import type { Pool } from '../model/Product';

export function PoolDialog({ viewmodel, onClose }: Readonly<{ viewmodel: ProductPoolViewModel; onClose: () => void }>) {
  if (!viewmodel.open) return null;
  return <div className="productflowoverlay"><button className="productflowbackdrop" type="button" onClick={onClose} aria-label="关闭商品池窗口" /><form className="productflowdialog productpooldialog" aria-label="商品池管理" onSubmit={(event) => { event.preventDefault(); viewmodel.submit(); }}>
    <header><div><p>商品池治理</p><h2>商品池管理</h2></div><button type="button" onClick={onClose} aria-label="关闭商品池窗口">×</button></header>
    <div className="productflowbody">
      <section className="productpoolsummary" aria-label="当前商品池">{viewmodel.loading ? <p>正在读取商品池…</p> : viewmodel.pools.map((pool) => <PoolCard key={pool.id} pool={pool} selected={viewmodel.selected?.id === pool.id} onSelect={viewmodel.select} />)}</section>
      <label>操作<select value={viewmodel.operation} onChange={(event) => viewmodel.setOperation(event.target.value as ProductPoolViewModel['operation'])}><option value="allocate">派生商品池</option><option value="attach">绑定到商城</option><option value="detach">从商城解绑</option></select></label>
      <label>目标商城<select value={viewmodel.target} onChange={(event) => viewmodel.setTarget(event.target.value)}>{viewmodel.malls.map((scope) => <option key={scope.id} value={scope.id}>{scope.name ?? chineseReference('组织范围', scope.id)}</option>)}</select></label>
      {viewmodel.operation === 'allocate' ? <><label>派生类型<select value={viewmodel.kind} onChange={(event) => viewmodel.setKind(event.target.value as ProductPoolViewModel['kind'])}><option value="channel">渠道商品池</option><option value="markup">加价商品池</option></select></label><label>商品池名称<input value={viewmodel.name} onChange={(event) => viewmodel.setName(event.target.value)} required maxLength={120} /></label></> : null}
      <p className="productflownote">全局池、私有池作为来源；渠道池、加价池可从选中来源池复制商品项并独立绑定商城。</p>
      {viewmodel.error === undefined ? null : <p role="alert" className="productflowerror">{viewmodel.error}</p>}
    </div>
    <footer><button type="button" onClick={onClose}>关闭</button><button className="productactionprimary" type="submit" disabled={viewmodel.selected === undefined || viewmodel.submitting}>{viewmodel.submitting ? '正在执行…' : '确认执行'}</button></footer>
  </form></div>;
}

function PoolCard({ pool, selected, onSelect }: Readonly<{ pool: Pool; selected: boolean; onSelect: (id: string) => void }>) {
  return <button type="button" aria-pressed={selected} onClick={() => onSelect(pool.id)}><strong>{pool.name}</strong><span>{poolKind(pool.kind)} · {pool.item_count} 件 · 第 {pool.version} 版</span></button>;
}

function poolKind(kind: string): string { return { global: '全局池', channel: '渠道池', private: '私有池', markup: '加价池' }[kind] ?? '其他商品池'; }
