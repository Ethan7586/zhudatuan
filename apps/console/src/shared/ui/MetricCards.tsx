export interface MetricCard {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly tone?: 'default' | 'success' | 'warning' | 'danger';
}

export function MetricCards({ items }: Readonly<{ items: readonly MetricCard[] }>) {
  return (
    <div className="metricgrid">
      {items.map((item) => (
        <article key={item.label} className={`metriccard metric${item.tone ?? 'default'}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail === undefined ? null : <small>{item.detail}</small>}
        </article>
      ))}
    </div>
  );
}
