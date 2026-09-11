import { ResourceState } from '@shop/design';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { scopePath } from '../../shared/url/ScopePath';
import { productKey, readProducts, type ProductQuery } from '../product/ProductQuery';
import { supplyPartnersFromListingPage, type SupplyPartnerSummary } from './SupplyChainModel';
import './supply-chain.css';

const supplyQuery: ProductQuery = Object.freeze({
  q: '', category: '', status: '', limit: 1, preview: true, view: 'supply-network',
});

export function Component() {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState('');
  const query = useQuery({
    queryKey: productKey(context, supplyQuery),
    queryFn: ({ signal }) => readProducts(context, supplyQuery, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error,
    hasData: query.data !== undefined, empty: false, stale: query.isStale });
  const error = safeQueryError(query.error);
  const unavailable = query.data === undefined && query.error !== null;
  const partners = useMemo(() => supplyPartnersFromListingPage(query.data), [query.data]);
  const visiblePartners = useMemo(() => {
    const normalized = queryText.trim().toLocaleLowerCase('zh-CN');
    return normalized === '' ? partners : partners.filter(({ name }) => name.toLocaleLowerCase('zh-CN').includes(normalized));
  }, [partners, queryText]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activeTab, setActiveTab] = useState<'overview' | 'economics'>('overview');
  const selected = visiblePartners.find(({ id }) => id === selectedId) ?? visiblePartners[0];
  useEffect(() => {
    if (selected !== undefined && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected?.id, selectedId]);

  if (condition === 'denied') {
    return <ResourceState condition="denied" resourceLabel="供应链管理"
      {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}><span /></ResourceState>;
  }

  return (
    <section className="supplychainpage">
      <header className="supplychainhead">
        <nav aria-label="供应链工作区"><button type="button" aria-current="page">供应网络 <strong>{partners.length}</strong></button></nav>
        <p>供货伙伴、供应商品与商城合作关系</p>
        <button className="supplyrefresh" type="button" onClick={() => { void query.refetch(); }} disabled={query.isFetching}>
          {query.isFetching ? '正在更新…' : '刷新'}
        </button>
      </header>
      <div className="supplysearch"><span aria-hidden="true">⌕</span><input value={queryText} onChange={(event) => setQueryText(event.target.value)}
        placeholder="搜索供应商、渠道商、品牌方或生产商" aria-label="搜索供应链伙伴" /></div>
      <ResourceState condition={condition === 'loading' || unavailable ? 'ready' : condition}
        {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}>
        {unavailable ? <SupplyUnavailable retry={() => { void query.refetch(); }} />
          : query.data === undefined ? <SupplySkeleton /> : partners.length === 0 ? <SupplyEmpty onProducts={() => { void navigate(scopePath(context.scope, 'products')); }} /> : (
          <div className="supplysplit">
            <section className="supplylist" aria-label="供货伙伴">
              <div className="supplylisthead"><span>供货伙伴</span><span>供应渠道</span><span>商品</span></div>
              {visiblePartners.map((partner) => <button key={partner.id} type="button" className={partner.id === selected?.id ? 'isselected' : ''}
                onClick={() => { setSelectedId(partner.id); setActiveTab('overview'); }}><span className="supplyavatar" aria-hidden="true">{Array.from(partner.name)[0]}</span><strong>{partner.name}</strong><span>{partner.channel}</span><b>{formatCount(partner.productCount)}</b></button>)}
              {visiblePartners.length === 0 ? <p className="supplynosearch">没有匹配的合作伙伴</p> : null}
            </section>
            {selected === undefined ? null : <section className="supplydetail" aria-label={`${selected.name}供应关系`}>
              <header><span className="supplylogo" aria-hidden="true">{Array.from(selected.name)[0]}</span><div><h1>{selected.name}<span>{agreementLabel(selected.agreementStatus)}</span></h1><p>{selected.channel} · 商品、价格和库存已经进入正式供应关系</p></div><button type="button" onClick={() => { void navigate(scopePath(context.scope, 'products')); }}>查看供应商品</button></header>
              <div className="supplymetrics" aria-label="供应经营指标"><article><span>供应商品</span><strong>{formatCount(selected.productCount)}</strong><small>{formatCount(selected.skuCount)} 个 SKU</small></article><article><span>已上架</span><strong>{formatCount(selected.publishedCount)}</strong><small>实时上架状态</small></article><article><span>可用库存</span><strong>{formatStock(selected.availableStock)}</strong><small>扣除安全库存</small></article><article><span>库存货值</span><strong>{formatMoney(selected.inventoryValueMinor)}</strong><small>按当前销售价</small></article></div>
              <section className="supplyroute"><h2>供应链路径</h2><div><article><strong>{selected.name}</strong><span>供应商</span></article><i><small>供货</small></i><article><strong>{selected.channel}</strong><span>渠道关系</span></article><i><small>进入</small></i><article><strong>{context.scope.name ?? '当前商城'}</strong><span>销售商城</span></article></div></section>
              <nav className="supplytabs"><button type="button" aria-current={activeTab === 'overview' ? 'page' : undefined} onClick={() => setActiveTab('overview')}>合作概览</button><button type="button" aria-current={activeTab === 'economics' ? 'page' : undefined} onClick={() => setActiveTab('economics')}>价格与库存</button></nav>
              {activeTab === 'overview' ? <SupplyOverview selected={selected} mallName={context.scope.name ?? '当前经营范围'} />
                : <SupplyEconomics selected={selected} />}
            </section>}
          </div>
        )}
      </ResourceState>
    </section>
  );
}

function SupplyOverview({ selected, mallName }: Readonly<{ selected: SupplyPartnerSummary; mallName: string }>) {
  return <div className="supplyfacts"><section><h2>合作档案</h2><dl><div><dt>供应渠道</dt><dd>{selected.channel}</dd></div><div><dt>合作状态</dt><dd>{agreementLabel(selected.agreementStatus)}</dd></div><div><dt>结算方式</dt><dd>{selected.settlementMode}</dd></div><div><dt>合作商城</dt><dd>{mallName}</dd></div><div><dt>协议编号</dt><dd>{selected.contractRef ?? '待补充'}</dd></div><div><dt>生效时间</dt><dd>{formatDate(selected.effectiveAt)}</dd></div><div><dt>最近同步</dt><dd>{formatTime(selected.lastSyncedAt)}</dd></div></dl></section><aside><h2>已接入能力</h2><div className="supplychips">{capabilityLabels(selected.capabilities).map((label) => <span key={label}>{label}</span>)}</div><p>商品、价格、库存和订单均沿同一供应关系归集，页面金额随实时价格与可用库存更新。</p></aside></div>;
}

function SupplyEconomics({ selected }: Readonly<{ selected: SupplyPartnerSummary }>) {
  return <div className="supplyfacts"><section><h2>价格与库存</h2><dl><div><dt>价格区间</dt><dd>{formatPriceRange(selected.minPriceMinor, selected.maxPriceMinor)}</dd></div><div><dt>可用库存</dt><dd>{formatCount(selected.availableStock)} 件</dd></div><div><dt>库存货值</dt><dd>{formatMoney(selected.inventoryValueMinor)}</dd></div><div><dt>在售 SKU</dt><dd>{formatCount(selected.skuCount)} 个</dd></div><div><dt>已上架商品</dt><dd>{formatCount(selected.publishedCount)} 个</dd></div><div><dt>1–2 元体验商品</dt><dd>{formatCount(selected.trialProductCount)} 个</dd></div></dl></section><aside><h2>口径说明</h2><p>可用库存已扣除安全库存和有效占用；库存货值按各 SKU 当前有效销售价计算。采购成本与结算金额保留在商品供应档案中。</p></aside></div>;
}

function SupplyEmpty({ onProducts }: Readonly<{ onProducts: () => void }>) {
  return <div className="supplyempty"><span aria-hidden="true">◇</span><h1>暂未发现供货伙伴</h1><p>商品建立真实供货关系后，供应商和渠道商会自动出现在这里。</p><button type="button" onClick={onProducts}>查看商品管理</button></div>;
}

function SupplyUnavailable({ retry }: Readonly<{ retry: () => void }>) {
  return <div className="supplyempty" role="status"><span aria-hidden="true">↻</span><h1>供应数据暂未同步</h1><p>页面已经可以使用，你可以立即重试本次读取。</p><button type="button" onClick={retry}>重新读取</button></div>;
}

function SupplySkeleton() {
  return <div className="supplyskeleton" aria-label="正在读取供应链"><span /><span /><span /></div>;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatTime(value: string | undefined): string {
  if (value === undefined) return '暂无';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDate(value: string | undefined): string {
  if (value === undefined) return '待补充';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function formatMoney(value: number): string {
  const amount = value / 100;
  if (amount >= 100_000_000) return `¥${(amount / 100_000_000).toFixed(2)}亿`;
  if (amount >= 10_000) return `¥${(amount / 10_000).toFixed(2)}万`;
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);
}

function formatStock(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return formatCount(value);
}

function formatPriceRange(minimum: number | null, maximum: number | null): string {
  if (minimum === null || maximum === null) return '暂无有效价格';
  const format = (value: number) => `¥${(value / 100).toFixed(2)}`;
  return minimum === maximum ? format(minimum) : `${format(minimum)} – ${format(maximum)}`;
}

function agreementLabel(status: string): string {
  return status === 'active' ? '合作中' : status === 'expired' ? '已到期' : status === 'terminated' ? '已终止' : '待生效';
}

function capabilityLabels(capabilities: readonly string[]): readonly string[] {
  const labels: Readonly<Record<string, string>> = Object.freeze({ catalog: '商品', pricing: '价格', inventory: '库存', ordering: '订单', fulfillment: '履约', after_sales: '售后', settlement: '结算' });
  return capabilities.map((capability) => labels[capability] ?? capability);
}
