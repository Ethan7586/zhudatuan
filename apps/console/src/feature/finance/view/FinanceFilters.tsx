import { Button } from '@shop/design';
import type { FinanceFacetGroup } from '../model/Finance';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';

type FilterKey = 'reconPeriod' | 'channel' | 'mall' | 'status' | 'difference';

export function FinanceFilters({ model }: Readonly<{ model: ReconciliationViewModel }>) {
  const facets = model.facets;
  if (facets.condition === 'loading')
    return (
      <section className="financefilterstate" role="status">
        正在读取可用筛选项…
      </section>
    );
  if (facets.condition === 'forbidden') return <section className="financefilterstate">{facets.error}</section>;
  if (!['ready', 'stale', 'refreshing'].includes(facets.condition))
    return (
      <section className="financefilterstate" role="alert">
        <span>{facets.error}</span>
        <Button onPress={facets.retry}>重新读取</Button>
      </section>
    );
  if (!facets.data) return null;
  return (
    <form className="financefilters" aria-label="对账筛选" onSubmit={(event) => event.preventDefault()}>
      <FacetSelect label="账期" group={facets.data.periods} value={model.filters.period} filter="reconPeriod" onChange={model.actions.filter} />
      <FacetSelect label="渠道" group={facets.data.providers} value={model.filters.provider} filter="channel" onChange={model.actions.filter} />
      <FacetSelect label="商城" group={facets.data.malls} value={model.filters.mall} filter="mall" onChange={model.actions.filter} />
      <FacetSelect label="状态" group={facets.data.states} value={model.filters.state} filter="status" onChange={model.actions.filter} />
      <FacetSelect label="差异类型" group={facets.data.differenceTypes} value={model.filters.differenceType} filter="difference" onChange={model.actions.filter} />
      {model.filters.active > 0 ? (
        <Button className="financefilterclear" tone="quiet" onPress={model.actions.clearFilters}>
          清除 {model.filters.active} 项筛选
        </Button>
      ) : null}
    </form>
  );
}

function FacetSelect({
  label,
  group,
  value,
  filter,
  onChange,
}: Readonly<{
  label: string;
  group: FinanceFacetGroup;
  value: string | undefined;
  filter: FilterKey;
  onChange: (key: FilterKey, value: string) => void;
}>) {
  if (group.items.length === 0)
    return (
      <section className="financefilterempty">
        <strong>{label}</strong>
        <span>{group.reason ?? `当前没有可用${label}。`}</span>
      </section>
    );
  return (
    <label>
      {label}
      <select value={value ?? ''} onChange={(event) => onChange(filter, event.target.value)}>
        <option value="">全部{label}</option>
        {group.items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}（{item.count.toLocaleString('zh-CN')}）
          </option>
        ))}
      </select>
    </label>
  );
}
