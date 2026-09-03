import { useState } from 'react';
import { chineseReference } from '@shop/presentation';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { OrderDrawerPanel } from './OrderDrawerPanel';
import { OrderIcon } from './OrderIcon';
import { formatOrderTime, fulfillmentLabel, fulfillmentTone, paymentLabel, paymentTone } from './OrderPresentation';
import type { OrderDetailTab, OrderRecord } from './OrderSchema';

const tabs: readonly Readonly<{ key: OrderDetailTab; label: string }>[] = Object.freeze([
  { key: 'overview', label: '订单概览' },
  { key: 'products', label: '商品与履约' },
  { key: 'payment', label: '支付与退款' },
  { key: 'aftersale', label: '售后' },
  { key: 'operations', label: '操作记录' },
]);

export function OrderDrawer({
  orderId,
  tab,
  query,
  onTab,
  onClose,
}: Readonly<{
  orderId: string;
  tab: OrderDetailTab;
  query: Readonly<{ data: OrderRecord | undefined; isPending: boolean; isError: boolean; error: string | undefined; refetch: () => void }>;
  onTab: (tab: OrderDetailTab) => void;
  onClose: () => void;
}>) {
  const [copied, setCopied] = useState(false);
  const order = query.data;

  const copyNumber = () => {
    if (order === undefined || navigator.clipboard === undefined) return;
    void navigator.clipboard
      .writeText(order.order_number)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  };

  return (
    <ModalOverlay
      className="orderdraweroverlay"
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="orderdrawermodal">
        <AriaDialog className="orderdrawer" aria-label={`订单详情 ${order?.order_number ?? chineseReference('内部订单', orderId)}`}>
          <header className="orderdrawerheader">
            <div>
              <p>订单详情</p>
              <div className="orderdrawertitleline">
                <Heading slot="title" id="orderdrawertitle">
                  {order?.order_number ?? '正在读取订单'}
                </Heading>
                <button type="button" onClick={copyNumber} disabled={order === undefined} aria-label={copied ? '订单号已复制' : '复制订单号'}>
                  <OrderIcon name={copied ? 'check' : 'copy'} />
                </button>
              </div>
              {order === undefined ? (
                <span className="ordermutetext">{chineseReference('内部订单', orderId)}</span>
              ) : (
                <>
                  <div className="orderdrawerbadges">
                    <span className={`orderstatuspill tone-${paymentTone(order.payment_state)}`}>{paymentLabel(order.payment_state)}</span>
                    <span className={`orderstatuspill tone-${fulfillmentTone(order.fulfillment_state)}`}>{fulfillmentLabel(order.fulfillment_state)}</span>
                  </div>
                  <span className="ordermutetext">
                    {order.mall_id ? chineseReference('商城', order.mall_id) : '商城编号不可用'} · {formatOrderTime(order.created_at)}
                  </span>
                </>
              )}
            </div>
            <button className="orderdrawerclose" type="button" onClick={onClose} aria-label="关闭订单详情">
              <OrderIcon name="close" />
            </button>
          </header>

          <Tabs
            className="orderdrawertabsystem"
            selectedKey={tab}
            onSelectionChange={(key) => {
              const selected = tabs.find((item) => item.key === key)?.key;
              if (selected !== undefined) onTab(selected);
            }}
          >
            <TabList className="orderdrawertabs" aria-label="订单详情分类">
              {tabs.map((item) => (
                <Tab key={item.key} id={item.key}>
                  {item.label}
                </Tab>
              ))}
            </TabList>
            <TabPanel id={tab} className="orderdrawerbody">
              {query.isPending ? (
                <p className="orderdrawerstate" role="status">
                  正在读取订单权威快照…
                </p>
              ) : null}
              {query.isError ? (
                <section className="orderdrawererror" role="alert">
                  <strong>订单详情读取失败</strong>
                  <p>暂时无法读取订单详情，请稍后重试。</p>
                  <button
                    type="button"
                    onClick={() => {
                      query.refetch();
                    }}
                  >
                    重试
                  </button>
                </section>
              ) : null}
              {!query.isPending && !query.isError && order === undefined ? (
                <section className="orderdrawerempty" role="status">
                  <strong>未找到订单</strong>
                  <p>当前详情读取只支持内部订单编号精确匹配，不支持使用展示订单号反查。</p>
                </section>
              ) : null}
              {order === undefined ? null : <OrderDrawerPanel order={order} tab={tab} />}
            </TabPanel>
          </Tabs>

          <footer className="orderdrawerfooter">
            <button type="button" onClick={onClose}>
              关闭
            </button>
          </footer>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
