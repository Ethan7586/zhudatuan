export interface MetricItem { readonly id?: string; readonly label: string; readonly value: string; readonly hint?: string; readonly detail?: string; readonly tone?: 'default' | 'success' | 'warning' | 'danger' }
export function MetricGrid({ items }: Readonly<{ items: readonly MetricItem[] }>) {
  return <dl className="metricgrid">{items.map((item) => <div key={item.id ?? item.label} className={`metriccard metric${item.tone ?? 'default'}`}><dt>{item.label}</dt><dd>{item.value}</dd>{item.detail ?? item.hint ? <p>{item.detail ?? item.hint}</p> : null}</div>)}</dl>;
}
