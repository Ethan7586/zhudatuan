import { chineseReference, chineseSectionLabel } from '@shop/presentation';
import { Button, DataTable, MetricGrid, ResourcePanel, type DataColumn } from '@shop/design';
import { useEffect } from 'react';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { OrderDetail, OrderLine, OrderPageTab, OrderSupportState } from '../model/Order';
import type { DetailViewModel } from '../viewmodel/DetailViewModel';
import { OrderCommandDialog } from './OrderCommandDialog';
import { OrderOverviewPanel } from './OrderOverviewPanel';
import { OrderPaymentPanel } from './OrderPaymentPanel';
import { OrderActivityPanel } from './OrderActivityPanel';
import { OrderFinancePanel } from './OrderFinancePanel';
import { OrderSupportPanel } from './OrderSupportPanel';
import { OrderFulfillmentSnapshot } from './OrderProductPanel';
import { OrderDetailSection, OrderSectionState } from './OrderDetailSection';
import { aftersaleLabel, fulfillmentLabel, paymentLabel } from './OrderPresentation';

const columns: readonly DataColumn<OrderLine>[] = [
  { key: 'title', label: '商品', render: (row) => row.title },
  { key: 'sku', label: '商品规格', render: (row) => chineseReference('规格', row.sku) },
  { key: 'quantity', label: '数量', render: (row) => row.quantity },
  { key: 'unit', label: '单价快照', render: (row) => formatMinor(row.unitMinor) },
  { key: 'discount', label: '优惠快照', render: (row) => formatMinor(row.discountMinor) },
  { key: 'payable', label: '应付快照', render: (row) => formatMinor(row.payableMinor) },
];

const tabs: readonly Readonly<{ key: OrderPageTab; label: string }>[] = Object.freeze([
  { key: 'overview', label: '概览' },
  { key: 'products', label: '商品' },
  { key: 'payment', label: '支付' },
  { key: 'fulfillment', label: '履约' },
  { key: 'aftersale', label: '售后' },
  { key: 'finance', label: '财务' },
  { key: 'support', label: '客服' },
  { key: 'audit', label: '审计' },
]);

export function OrderDetailPage({ title, tab, onTab, onBack, viewmodel }: Readonly<{ title: string; tab: OrderPageTab; onTab: (tab: OrderPageTab) => void; onBack: () => void; viewmodel: DetailViewModel }>) {
  const data = viewmodel.data;
  const visibleTabs = data === undefined ? tabs : tabs.filter((item) => sectionVisible(item.key, data, viewmodel.support));
  const currentTab = visibleTabs.some((item) => item.key === tab) ? tab : 'overview';
  useEffect(() => {
    if (data !== undefined && currentTab !== tab) onTab(currentTab);
  }, [currentTab, data, onTab, tab]);
  return (
    <ResourcePanel
      title={data?.order_number ?? title}
      eyebrow={chineseSectionLabel('订单详情')}
      description={data === undefined ? '正在读取订单权威快照。' : `${chineseReference('订单', data.order_number)}的支付、履约、退款、脱敏地址与审计权威快照。`}
      condition={viewmodel.condition}
      {...(viewmodel.error === undefined ? {} : { error: viewmodel.error })}
      retry={viewmodel.refresh}
      actions={<><Button onPress={onBack}>返回订单列表</Button>{viewmodel.canCancel ? <Button onPress={viewmodel.actions.openCancel}>取消订单</Button> : null}{viewmodel.canRemind ? <Button onPress={viewmodel.actions.openReminder}>提醒履约</Button> : null}{viewmodel.canReceive ? <Button tone="primary" onPress={viewmodel.actions.openReceive}>确认收货</Button> : null}<Button onPress={viewmodel.refresh}>刷新订单</Button></>}
    >
      {data === undefined ? (
        <span />
      ) : (
        <div className="featurestack">
          <MetricGrid
            items={[
              { label: '业务订单号', value: data.order_number },
              { label: '服务端应付', value: formatMinor(data.total_minor, data.currency) },
              { label: '支付状态', value: paymentLabel(data.payment_state) },
              { label: '履约状态', value: fulfillmentLabel(data.fulfillment_state) },
              { label: '售后状态', value: aftersaleLabel(data.aftersale_state) },
              { label: '版本', value: `第 ${data.version} 版`, detail: formatDate(data.updated_at) },
            ]}
          />
          <nav className="orderdetailtabs" aria-label="订单详情分区" role="tablist">
            {visibleTabs.map((item) => <button key={item.key} id={`ordertab-${item.key}`} type="button" role="tab" aria-selected={currentTab === item.key} aria-controls={`orderpanel-${item.key}`} tabIndex={currentTab === item.key ? 0 : -1} onClick={() => onTab(item.key)}>{item.label}</button>)}
          </nav>
          <section id={`orderpanel-${currentTab}`} role="tabpanel" aria-labelledby={`ordertab-${currentTab}`}>
            <OrderPagePanel data={data} tab={currentTab} viewmodel={viewmodel} />
          </section>
          <OrderCommandDialog model={viewmodel} />
        </div>
      )}
    </ResourcePanel>
  );
}

function sectionVisible(tab: OrderPageTab, order: OrderDetail, support: OrderSupportState): boolean {
  if (tab === 'products') return order.sections.products.state !== 'hidden';
  if (tab === 'payment') return order.sections.payment.state !== 'hidden';
  if (tab === 'fulfillment') return order.sections.fulfillment.state !== 'hidden';
  if (tab === 'aftersale') return order.sections.aftersale.state !== 'hidden';
  if (tab === 'finance') return order.sections.finance.state !== 'hidden';
  if (tab === 'support') return support.state !== 'hidden';
  if (tab === 'audit') return order.sections.audit.state !== 'hidden';
  return true;
}

function OrderPagePanel({ data, tab, viewmodel }: Readonly<{ data: NonNullable<DetailViewModel['data']>; tab: OrderPageTab; viewmodel: DetailViewModel }>) {
  if (tab === 'overview') return <OrderOverviewPanel order={data} onRetry={viewmodel.refresh} />;
  if (tab === 'products') return <OrderDetailSection title="订单商品快照"><OrderSectionState section={data.sections.products} title="商品快照" onRetry={viewmodel.refresh} />{data.sections.products.state === 'ready' ? <DataTable caption="订单商品明细" columns={columns} rows={data.lines} rowKey={(row) => row.id} /> : null}</OrderDetailSection>;
  if (tab === 'payment') return <OrderPaymentPanel order={data} onRetry={viewmodel.refresh} viewmodel={viewmodel} />;
  if (tab === 'fulfillment') return <div className="orderdrawerstack"><OrderFulfillmentSnapshot order={data} onRetry={viewmodel.refresh} canShip={viewmodel.canShip} onShip={viewmodel.actions.openShip} /></div>;
  if (tab === 'aftersale') return <OrderActivityPanel order={data} mode="aftersale" onRetry={viewmodel.refresh} />;
  if (tab === 'finance') return <OrderFinancePanel order={data} onRetry={viewmodel.refresh} />;
  if (tab === 'support') return <OrderSupportPanel support={viewmodel.support} onRetry={viewmodel.refreshSupport} />;
  return <OrderActivityPanel order={data} mode="operations" onRetry={viewmodel.refresh} />;
}
