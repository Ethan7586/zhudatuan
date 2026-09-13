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
  const marketSales = sumKnown(candidates.map(({ selection }) => selection?.marketSales30d));
  const mallSales = sumKnown(candidates.map(({ selection }) => selection?.mallSales30d));
  const averageClickRate = averageKnown(candidates.map(({ selection }) => selection?.clickThroughRateBps));
  const pricedCandidates = candidates.filter(({ selection }) => selection?.peerLowestPriceMinor != null
    && selection.suggestedRetailMinor != null);
  const priceAdvantage = pricedCandidates.length === 0 ? null : pricedCandidates.filter(({ selection }) =>
    selection!.suggestedRetailMinor! <= selection!.peerLowestPriceMinor!).length;

  return (
    <section className="selectioncenter" aria-labelledby="selectioncentertitle">
      <header className="selectionintro">
        <div>
          <span className="selectioneyebrow">CURATED COMMERCE</span>
          <h2 id="selectioncentertitle">找到值得卖的商品</h2>
          <p>用市场销量、价格优势和本店经营数据，快速判断什么值得选。</p>
        </div>
        <dl aria-label="当前选品经营数据">
          <div><dt>市场近 30 天销量</dt><dd>{metricCount(marketSales)}</dd></div>
          <div><dt>本店选品成交</dt><dd>{metricCount(mallSales)}</dd></div>
          <div><dt>平均点击率</dt><dd>{rate(averageClickRate)}</dd></div>
          <div><dt>价格优势商品</dt><dd>{metricCount(priceAdvantage)}</dd></div>
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
        <span className="selectionsource">{detail.sourceChannel}</span>
        {detail.recommendationScore == null ? null : <span className="selectionscore">
          推荐 {detail.recommendationScore}{detail.salesGrowthBps == null ? null : <em>+{rate(detail.salesGrowthBps)}</em>}
        </span>}
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
        <div className="selectionsignals" aria-label="商品选品数据">
          <div><span>市场销量</span><strong className="selectionhot">{metricCount(detail.marketSales30d)}</strong></div>
          <div><span>同款低价</span><strong>{money(detail.peerLowestPriceMinor)}</strong></div>
          <div><span>本店销量</span><strong>{metricCount(detail.mallSales30d)}</strong></div>
          <div><span>点击率</span><strong className="selectiongood">{rate(detail.clickThroughRateBps)}</strong></div>
        </div>
        <div className="selectioncardmeta"><span>{detail.supplierName}</span><span>可用库存 {stock(detail.availableStock)}</span></div>
        <button type="button" disabled={detail.selected || !canSelect || pending} onClick={onSelect}>
          {detail.selected ? <><ProductIcon name="check" />已选入</> : <><ProductIcon name="plus" />选入商品目录</>}
        </button>
      </div>
    </article>
  );
}

function money(value: number | null | undefined): string {
  return value == null ? '待同步' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value / 100);
}

function stock(value: number | null): string {
  return value === null ? '待同步' : new Intl.NumberFormat('zh-CN').format(value);
}

function grossMargin(cost: number | null, retail: number | null): string {
  if (cost === null || retail === null || retail <= 0) return '待计算';
  return `${Math.max(0, Math.round(((retail - cost) / retail) * 100))}%`;
}

function sumKnown(values: readonly (number | null | undefined)[]): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

function averageKnown(values: readonly (number | null | undefined)[]): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length === 0 ? null : Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
}

function metricCount(value: number | null | undefined): string {
  if (value == null) return '待同步';
  if (value >= 10_000) return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value / 10_000)}万`;
  return new Intl.NumberFormat('zh-CN').format(value);
}

function rate(value: number | null | undefined): string {
  return value == null ? '待同步' : `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value / 100)}%`;
}
