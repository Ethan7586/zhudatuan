import { ResourceState } from '@shop/design';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { scopePath } from '../../shared/url/ScopePath';
import { productKey, readProducts, type ProductQuery } from '../product/ProductQuery';
import { supplyPartnersFromListingPage } from './SupplyChainModel';
import './supply-chain.css';

const supplyQuery: ProductQuery = Object.freeze({ q: '', category: '', status: '', limit: 20, preview: true });

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
              <div className="supplylisthead"><span>供货伙伴</span><span>主体类型</span><span>供应商品</span></div>
              {visiblePartners.map((partner) => <button key={partner.id} type="button" className={partner.id === selected?.id ? 'isselected' : ''}
                onClick={() => setSelectedId(partner.id)}><span className="supplyavatar" aria-hidden="true">{Array.from(partner.name)[0]}</span><strong>{partner.name}</strong><span>供应商</span><b>{formatCount(partner.productCount)}</b></button>)}
              {visiblePartners.length === 0 ? <p className="supplynosearch">没有匹配的合作伙伴</p> : null}
            </section>
            {selected === undefined ? null : <section className="supplydetail" aria-label={`${selected.name}供应关系`}>
              <header><span className="supplylogo" aria-hidden="true">{Array.from(selected.name)[0]}</span><div><h1>{selected.name}<span>供应商</span></h1><p>当前商品档案中包含 {formatCount(selected.productCount)} 件供应商品</p></div><button type="button" onClick={() => { void navigate(scopePath(context.scope, 'products')); }}>查看供应商品</button></header>
              <section className="supplyroute"><h2>供应链路径</h2><div><article><strong>{selected.name}</strong><span>供应商</span></article><i><small>供货</small></i><article><strong>{context.scope.name ?? '当前经营主体'}</strong><span>合作去向</span></article><i><small>进入</small></i><article><strong>商城商品</strong><span>销售范围</span></article></div></section>
              <nav className="supplytabs"><button type="button" aria-current="page">概览</button><button type="button">供应商品 {formatCount(selected.productCount)}</button></nav>
              <div className="supplyfacts"><section><h2>合作概览</h2><dl><div><dt>主体类型</dt><dd>供应商</dd></div><div><dt>供应商品</dt><dd>{formatCount(selected.productCount)} 件</dd></div><div><dt>合作去向</dt><dd>{context.scope.name ?? '当前经营范围'}</dd></div><div><dt>最近同步</dt><dd>{formatTime(selected.lastSyncedAt)}</dd></div></dl></section><aside><h2>数据说明</h2><p>当前仅展示商品档案能够确认的供货伙伴。渠道类型、联系人、合同与结算将在正式供应关系数据接入后显示。</p></aside></div>
            </section>}
          </div>
        )}
      </ResourceState>
    </section>
  );
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
