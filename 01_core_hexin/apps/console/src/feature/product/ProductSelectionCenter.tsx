import { useEffect, useMemo, useState } from 'react';
import { ProductIcon } from './ProductIcon';
import type { Listing } from './ProductSchema';

type SelectionLens = 'all' | 'supply' | 'brand';

interface ProductSelectionCenterProps {
  readonly rows: readonly Listing[];
  readonly query: string;
  readonly selected: ReadonlySet<string>;
  readonly canSelect: boolean;
  readonly pending: boolean;
  readonly feedback?: string;
  readonly onQuery: (query: string) => void;
  readonly onToggle: (id: string) => void;
  readonly onToggleAll: (ids: readonly string[]) => void;
  readonly onSelect: (ids: readonly string[]) => void;
}

export function ProductSelectionCenter({ rows, query, selected, canSelect, pending, feedback, onQuery, onToggle,
  onToggleAll, onSelect }: ProductSelectionCenterProps) {
  const [lens, setLens] = useState<SelectionLens>('all');
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const candidates = rows.filter(({ selection }) => selection?.kind === 'selection-center-v1');
  const suppliers = useMemo(() => new Set(candidates.map(({ selection }) => selection?.supplierName).filter(Boolean)), [candidates]);
  const brands = useMemo(() => new Set(candidates.map(({ selection }) => selection?.brandName)
    .filter((name) => name !== undefined && name !== '未标注品牌')), [candidates]);
  const visible = candidates.filter(({ selection }) => lens !== 'brand' || selection?.brandName !== '未标注品牌');
  const available = visible.filter(({ selection }) => selection?.selected === false);
  const visibleSelected = available.filter(({ id }) => selected.has(id));
  const allSelected = available.length > 0 && available.every(({ id }) => selected.has(id));

  return (
    <section className="selectioncenter" aria-labelledby="selectioncentertitle">
      <header className="selectionintro">
        <div>
          <span className="selectioneyebrow">CURATED COMMERCE</span>
          <h2 id="selectioncentertitle">找到值得卖的商品</h2>
          <p>从合作供应链与品牌商品中快速筛选，一次选入自己的商品目录。</p>
        </div>
        <dl aria-label="当前候选商品概况">
          <div><dt>本页候选</dt><dd>{candidates.length}</dd></div>
          <div><dt>合作供应链</dt><dd>{suppliers.size}</dd></div>
          <div><dt>品牌</dt><dd>{brands.size}</dd></div>
          <div><dt>待选入</dt><dd>{candidates.filter(({ selection }) => !selection?.selected).length}</dd></div>
        </dl>
      </header>

      <nav className="selectionlenses" aria-label="选品来源">
        <LensButton active={lens === 'all'} title="全部优选" detail="聚合全部可选商品" onClick={() => setLens('all')} />
        <LensButton active={lens === 'supply'} title="供应链" detail={`${suppliers.size} 家合作供货方`} onClick={() => setLens('supply')} />
        <LensButton active={lens === 'brand'} title="品牌馆" detail={`${brands.size} 个品牌与系列`} onClick={() => setLens('brand')} />
      </nav>

      <form className="selectiontoolbar" onSubmit={(event) => { event.preventDefault(); onQuery(draft.trim()); }}>
        <label>
          <ProductIcon name="search" />
          <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="搜索选品中心"
            placeholder="搜索商品、品牌、供应商或 SKU" />
        </label>
        <button type="submit" className="selectionsearch">搜索</button>
        {query === '' ? null : <button type="button" className="selectionreset" onClick={() => { setDraft(''); onQuery(''); }}>重置</button>}
        <span>供货价、库存与品牌信息均来自当前货盘</span>
      </form>

      {visible.length === 0 ? (
        <div className="selectionempty"><ProductIcon name="inventory" /><strong>当前条件下没有可选商品</strong><span>换一个关键词或来源继续查看。</span></div>
      ) : (
        <div className="selectiongrid" aria-label="选品商品池">
          {visible.map((row) => <SelectionCard key={row.id} row={row} checked={selected.has(row.id)}
            canSelect={canSelect} pending={pending} onToggle={() => onToggle(row.id)} onSelect={() => onSelect([row.id])} />)}
        </div>
      )}

      {available.length === 0 ? null : (
        <footer className="selectionbatch">
          <label><input type="checkbox" checked={allSelected} onChange={() => onToggleAll(available.map(({ id }) => id))} />选择本页未选商品</label>
          <span>{visibleSelected.length === 0 ? '勾选商品后可以批量选入' : `已选择 ${visibleSelected.length} 件商品`}</span>
          {feedback === undefined ? null : <strong role="status">{feedback}</strong>}
          <button type="button" disabled={!canSelect || pending || visibleSelected.length === 0}
            onClick={() => onSelect(visibleSelected.map(({ id }) => id))}>
            <ProductIcon name="plus" />{pending ? '正在选入…' : '批量选入商品目录'}
          </button>
        </footer>
      )}
    </section>
  );
}

function LensButton({ active, title, detail, onClick }: Readonly<{
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}>) {
  return <button type="button" aria-current={active ? 'page' : undefined} onClick={onClick}>
    <strong>{title}</strong><span>{detail}</span>
  </button>;
}

function SelectionCard({ row, checked, canSelect, pending, onToggle, onSelect }: Readonly<{
  row: Listing;
  checked: boolean;
  canSelect: boolean;
  pending: boolean;
  onToggle: () => void;
  onSelect: () => void;
}>) {
  const detail = row.selection!;
  const margin = grossMargin(detail.supplyPriceMinor, detail.suggestedRetailMinor);
  return (
    <article className="selectioncard" data-selected={detail.selected ? 'true' : undefined}>
      <div className="selectionmedia">
        {row.cover_url == null || row.cover_url === '' ? <ProductIcon name="cube" /> : (
          <img src={row.cover_url} alt="" loading="lazy" decoding="async"
            onError={(event) => { event.currentTarget.hidden = true; }} />
        )}
        <span>{detail.sourceChannel}</span>
        {detail.selected ? <strong><ProductIcon name="check" />已在商品目录</strong> : (
          <label><input type="checkbox" checked={checked} onChange={onToggle} aria-label={`选择 ${row.title}`} /></label>
        )}
      </div>
      <div className="selectioncardbody">
        <div className="selectiontags"><span>{detail.brandName}</span><span>{detail.categoryName}</span></div>
        <h3>{row.title}</h3>
        <p>{row.subtitle ?? `${detail.supplierName}提供`}</p>
        <dl>
          <div><dt>供货价</dt><dd>{money(detail.supplyPriceMinor)}</dd></div>
          <div><dt>建议售价</dt><dd>{money(detail.suggestedRetailMinor)}</dd></div>
          <div><dt>预计毛利</dt><dd className="selectionmargin">{margin}</dd></div>
        </dl>
        <div className="selectioncardmeta"><span>{detail.supplierName}</span><span>可用库存 {stock(detail.availableStock)}</span></div>
        <button type="button" disabled={detail.selected || !canSelect || pending} onClick={onSelect}>
          {detail.selected ? <><ProductIcon name="check" />已选入</> : <><ProductIcon name="plus" />选入商品目录</>}
        </button>
      </div>
    </article>
  );
}

function money(value: number | null): string {
  return value === null ? '待确认' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value / 100);
}

function stock(value: number | null): string {
  return value === null ? '待同步' : new Intl.NumberFormat('zh-CN').format(value);
}

function grossMargin(cost: number | null, retail: number | null): string {
  if (cost === null || retail === null || retail <= 0) return '待计算';
  return `${Math.max(0, Math.round(((retail - cost) / retail) * 100))}%`;
}
