import type { OrderDetailTab, OrderRecord } from '../model/Order';
import { OrderActivityPanel } from './OrderActivityPanel';
import { OrderOverviewPanel } from './OrderOverviewPanel';
import { OrderPaymentPanel } from './OrderPaymentPanel';
import { OrderProductPanel } from './OrderProductPanel';

export function OrderDrawerPanel({ order, tab }: Readonly<{ order: OrderRecord; tab: OrderDetailTab }>) {
  if (tab === 'products') return <OrderProductPanel order={order} />;
  if (tab === 'payment') return <OrderPaymentPanel order={order} />;
  if (tab === 'aftersale') return <OrderActivityPanel order={order} mode="aftersale" />;
  if (tab === 'operations') return <OrderActivityPanel order={order} mode="operations" />;
  return <OrderOverviewPanel order={order} />;
}
