import type { ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { OrderDetailTabSchema, type OrderDetailTab } from './OrderSchema';
import './order-detail-tabs.css';

export const orderDetailTabs: readonly Readonly<{ key: OrderDetailTab; label: string }>[] = Object.freeze([
  { key: 'overview', label: '订单概览' },
  { key: 'products', label: '商品与履约' },
  { key: 'payment', label: '支付与退款' },
  { key: 'aftersale', label: '售后' },
  { key: 'operations', label: '操作记录' },
]);

export function OrderDetailTabs({
  selected,
  onSelectionChange,
  children,
}: Readonly<{
  selected: OrderDetailTab;
  onSelectionChange: (tab: OrderDetailTab) => void;
  children: ReactNode;
}>) {
  return (
    <Tabs
      className="orderdrawertabsystem"
      selectedKey={selected}
      onSelectionChange={(key) => {
        const parsed = OrderDetailTabSchema.safeParse(key);
        if (parsed.success) onSelectionChange(parsed.data);
      }}
    >
      <TabList className="orderdrawertabs" aria-label="订单详情分类">
        {orderDetailTabs.map((item) => (
          <Tab key={item.key} id={item.key}>
            <span className="orderdrawertablabel">{item.label}</span>
          </Tab>
        ))}
      </TabList>
      <TabPanel id={selected} className="orderdrawerbody">
        {children}
      </TabPanel>
    </Tabs>
  );
}
