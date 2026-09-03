import type { OrderView } from './OrderSchema';

interface StatusTab {
  readonly key: OrderView;
  readonly label: string;
}

const tabs: readonly StatusTab[] = Object.freeze([
  { key: 'all', label: '全部订单' },
  { key: 'aftersale', label: '售后与退款' },
]);

export function OrderStatusTabs({
  active,
  onChange,
}: Readonly<{
  active: OrderView;
  onChange: (view: OrderView) => void;
}>) {
  return (
    <nav className="orderstatustabs" aria-label="订单状态">
      {tabs.map((tab) => (
        <button key={tab.key} type="button" aria-pressed={active === tab.key} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
