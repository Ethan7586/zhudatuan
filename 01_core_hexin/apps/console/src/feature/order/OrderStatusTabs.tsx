import { Badge, Button } from '@shop/design';
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
        const count = counts?.[tab.key];
        return (
          <Button
            key={tab.key}
            className="orderstatusfilter"
            size="compact"
            tone="quiet"
            aria-pressed={active === tab.key}
            data-selected={active === tab.key || undefined}
            onPress={() => onChange(tab.key)}
          >
            <span>{tab.label}</span>
            {count === undefined ? null : <Badge tone={tab.key === 'exception' ? 'danger' : 'info'}>{count}</Badge>}
          </Button>
        );
      })}
    </nav>
  );
}
