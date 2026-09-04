import type { OrderDetail, OrderDetailTab } from '../model/Order';
import type { DetailViewModel } from '../viewmodel/DetailViewModel';
import { OrderActivityPanel } from './OrderActivityPanel';
import { OrderFinancePanel } from './OrderFinancePanel';
import { OrderOverviewPanel } from './OrderOverviewPanel';
import { OrderPaymentPanel } from './OrderPaymentPanel';
import { OrderProductPanel } from './OrderProductPanel';
import { OrderSupportPanel } from './OrderSupportPanel';

export function OrderDrawerPanel({ order, tab, viewmodel }: Readonly<{ order: OrderDetail; tab: OrderDetailTab; viewmodel: DetailViewModel }>) {
  if (tab === 'products') return <OrderProductPanel order={order} onRetry={viewmodel.refresh} viewmodel={viewmodel} />;
  if (tab === 'payment') return <OrderPaymentPanel order={order} onRetry={viewmodel.refresh} viewmodel={viewmodel} />;
  if (tab === 'aftersale') return <OrderActivityPanel order={order} mode="aftersale" onRetry={viewmodel.refresh} />;
  if (tab === 'finance') return <OrderFinancePanel order={order} onRetry={viewmodel.refresh} />;
  if (tab === 'support') return <OrderSupportPanel support={viewmodel.support} onRetry={viewmodel.refreshSupport} />;
  if (tab === 'operations') return <OrderActivityPanel order={order} mode="operations" onRetry={viewmodel.refresh} />;
  return <OrderOverviewPanel order={order} onRetry={viewmodel.refresh} />;
}
