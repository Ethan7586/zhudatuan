import type { FinanceFacetGroup } from '../model/Finance';
import type { OverviewViewModel } from '../viewmodel/OverviewViewModel';

export function FinanceFacetSummary({ model }: Readonly<{ model: OverviewViewModel }>) {
  if (model.facets.condition === 'loading')
    return (
      <section className="financefacetsummary" role="status">
        正在读取财务范围摘要…
      </section>
    );
  if (model.facets.condition === 'forbidden') return null;
  if (!['ready', 'stale', 'refreshing'].includes(model.facets.condition))
    return (
      <section className="financefacetsummary" role="alert">
        <span>{model.facets.error}</span>
        <button type="button" onClick={model.facets.retry}>
          重新读取
        </button>
      </section>
    );
  const facets = model.facets.data;
  if (!facets) return null;
  return (
    <section className="financefacetgrid" aria-label="财务筛选范围摘要">
      <FacetSummary label="账期" group={facets.periods} />
      <FacetSummary label="渠道" group={facets.providers} />
      <FacetSummary label="商城" group={facets.malls} />
      <FacetSummary label="状态" group={facets.states} />
      <FacetSummary label="差异类型" group={facets.differenceTypes} />
    </section>
  );
}

function FacetSummary({ label, group }: Readonly<{ label: string; group: FinanceFacetGroup }>) {
  const count = group.items.reduce((total, item) => total + item.count, 0);
  return (
    <article>
      <span>{label}</span>
      {group.items.length > 0 ? (
        <>
          <strong>{group.items.length.toLocaleString('zh-CN')}</strong>
          <small>覆盖 {count.toLocaleString('zh-CN')} 条记录</small>
        </>
      ) : (
        <small>{group.reason ?? `当前没有可用${label}。`}</small>
      )}
    </article>
  );
}
