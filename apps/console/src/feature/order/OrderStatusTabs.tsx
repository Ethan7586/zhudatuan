import type { OrderPage, OrderView } from './OrderSchema';

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
  { key: 'exception', label: '异常' },
]);

export function OrderStatusTabs({
  active,
  previewEnabled,
  page,
  onChange,
}: Readonly<{
  active: OrderView;
  previewEnabled: boolean;
  page: OrderPage | undefined;
  onChange: (view: OrderView) => void;
}>) {
  const counts = previewEnabled && page?.preview?.source === 'local-preview' ? page.preview.counts : undefined;
  return (
    <nav className="orderstatustabs" aria-label="订单状态">
      {tabs.map((tab) => {
        const disabled = !previewEnabled && tab.key !== 'all';
        const count = counts?.[tab.key];
        return (
          <button key={tab.key} type="button" aria-pressed={active === tab.key} disabled={disabled} title={disabled ? '等待服务端状态筛选与全量计数合同' : undefined} onClick={() => onChange(tab.key)}>
            {tab.label}
            {count === undefined ? null : <span className={tab.key === 'exception' ? 'isexception' : undefined}>{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
