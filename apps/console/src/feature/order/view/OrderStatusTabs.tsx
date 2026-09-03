import type { OrderView } from '../model/OrderFilter';

interface StatusTab {
  readonly key: OrderView;
  readonly label: string;
}

const tabs: readonly StatusTab[] = Object.freeze([
  { key: 'all', label: '全部订单' },
  { key: 'unpaid', label: '待付款' },
  { key: 'unshipped', label: '待发货' },
  { key: 'active', label: '履约中' },
  { key: 'completed', label: '已完成' },
  { key: 'aftersale', label: '售后与退款' },
  { key: 'exception', label: '异常订单' },
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
