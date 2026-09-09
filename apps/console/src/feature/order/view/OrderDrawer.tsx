import { Dialog as AriaDialog, Heading, Modal, ModalOverlay, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useEffect } from 'react';
import { Button } from '@shop/design';
import { OrderDrawerPanel } from './OrderDrawerPanel';
import { OrderIcon } from './OrderIcon';
import { formatOrderTime, fulfillmentLabel, fulfillmentTone, paymentLabel, paymentTone } from './OrderPresentation';
import type { OrderDetailTab } from '../model/Order';
import type { DetailViewModel } from '../viewmodel/DetailViewModel';
import { OrderCommandDialog } from './OrderCommandDialog';

const tabs: readonly Readonly<{ key: OrderDetailTab; label: string }>[] = Object.freeze([
  { key: 'overview', label: '订单概览' },
  { key: 'products', label: '商品与履约' },
  { key: 'payment', label: '支付与退款' },
  { key: 'aftersale', label: '售后' },
  { key: 'finance', label: '财务核对' },
  { key: 'support', label: '客服工单' },
  { key: 'operations', label: '操作记录' },
]);

export function OrderDrawer({
  orderId,
  tab,
  viewmodel,
  onTab,
  onDetail,
  onClose,
}: Readonly<{
  orderId: string;
  tab: OrderDetailTab;
  viewmodel: DetailViewModel;
  onTab: (tab: OrderDetailTab) => void;
  onDetail: () => void;
  onClose: () => void;
}>) {
  const order = viewmodel.data;
  const visibleTabs = order === undefined ? tabs : tabs.filter((item) => tabVisible(item.key, order, viewmodel.support));
  const currentTab = visibleTabs.some((item) => item.key === tab) ? tab : 'overview';
  useEffect(() => {
    if (order !== undefined && currentTab !== tab) onTab(currentTab);
  }, [currentTab, onTab, order, tab]);

  return (
    <>
      <ModalOverlay
        className="orderdraweroverlay"
        isOpen
        isDismissable
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal className="orderdrawermodal">
          <AriaDialog className="orderdrawer" aria-label={`订单详情 ${order?.order_number ?? '正在读取'}`}>
            <header className="orderdrawerheader">
              <div>
                <p>订单详情</p>
                <div className="orderdrawertitleline">
                  <Heading slot="title" id="orderdrawertitle">
                    {order?.order_number ?? '正在读取订单'}
                  </Heading>
                  <Button className="orderdrawercopy" tone="quiet" onPress={viewmodel.copyNumber} isDisabled={order === undefined} aria-label={viewmodel.copied ? '订单号已复制' : '复制订单号'}>
                    <OrderIcon name={viewmodel.copied ? 'check' : 'copy'} />
                  </Button>
                </div>
                {order === undefined ? (
                  <span className="ordermutetext">正在读取订单信息</span>
                ) : (
                  <>
                    <div className="orderdrawerbadges">
                      <span className={`orderstatuspill tone-${paymentTone(order.payment_state)}`}>{paymentLabel(order.payment_state)}</span>
                      <span className={`orderstatuspill tone-${fulfillmentTone(order.fulfillment_state)}`}>{fulfillmentLabel(order.fulfillment_state)}</span>
                    </div>
                    <span className="ordermutetext">
                      {order.mall_name} · {formatOrderTime(order.created_at)}
                    </span>
                  </>
                )}
              </div>
              <Button className="orderdrawerclose" tone="quiet" onPress={onClose} aria-label="关闭订单详情">
                <OrderIcon name="close" />
              </Button>
            </header>

            <Tabs
              className="orderdrawertabsystem"
              selectedKey={currentTab}
              onSelectionChange={(key) => {
                const selected = tabs.find((item) => item.key === key)?.key;
                if (selected !== undefined) onTab(selected);
              }}
            >
              <TabList className="orderdrawertabs" aria-label="订单详情分类">
                {visibleTabs.map((item) => (
                  <Tab key={item.key} id={item.key}>
                    {item.label}
                  </Tab>
                ))}
              </TabList>
              <TabPanel id={currentTab} className="orderdrawerbody">
                {viewmodel.pending ? (
                  <p className="orderdrawerstate" role="status">
                    正在读取订单权威快照…
                  </p>
                ) : null}
                {viewmodel.failed ? (
                  <section className="orderdrawererror" role="alert">
                    <strong>订单详情读取失败</strong>
                    <p>{viewmodel.error ?? '暂时无法读取订单详情，请稍后重试。'}</p>
                    {viewmodel.trace ? <small>请求追踪号：{viewmodel.trace}</small> : null}
                    <button
                      type="button"
                      onClick={() => {
                        viewmodel.refresh();
                      }}
                    >
                      重试
                    </button>
                  </section>
                ) : null}
                {!viewmodel.pending && !viewmodel.failed && order === undefined ? (
                  <section className="orderdrawerempty" role="status">
                    <strong>未找到订单</strong>
                    <p>未找到与当前链接对应的订单。</p>
                  </section>
                ) : null}
                {order === undefined ? null : <OrderDrawerPanel order={order} tab={currentTab} viewmodel={viewmodel} />}
              </TabPanel>
            </Tabs>

            <footer className="orderdrawerfooter">
              <div className="orderdraweractions">
                {order ? <Button onPress={onDetail}>打开完整详情</Button> : null}
                {viewmodel.canCancel ? <Button onPress={viewmodel.actions.openCancel}>取消订单</Button> : null}
                {viewmodel.canRemind ? <Button onPress={viewmodel.actions.openReminder}>提醒履约</Button> : null}
                {viewmodel.canReceive ? <Button onPress={viewmodel.actions.openReceive}>确认收货</Button> : null}
              </div>
              <Button className="orderdrawerfinish" onPress={onClose}>
                关闭
              </Button>
            </footer>
          </AriaDialog>
        </Modal>
      </ModalOverlay>
      <OrderCommandDialog model={viewmodel} />
    </>
  );
}

function tabVisible(tab: OrderDetailTab, order: NonNullable<DetailViewModel['data']>, support: DetailViewModel['support']): boolean {
  if (tab === 'products') return order.sections.products.state !== 'hidden' || order.sections.fulfillment.state !== 'hidden';
  if (tab === 'payment') return order.sections.payment.state !== 'hidden' || order.sections.aftersale.state !== 'hidden';
  if (tab === 'aftersale') return order.sections.aftersale.state !== 'hidden';
  if (tab === 'finance') return order.sections.finance.state !== 'hidden';
  if (tab === 'support') return support.state !== 'hidden';
  if (tab === 'operations') return order.sections.audit.state !== 'hidden';
  return true;
}
