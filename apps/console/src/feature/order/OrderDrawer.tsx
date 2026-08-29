import { ResourceState } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Dialog as AriaDialog, Heading, Modal, ModalOverlay, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { orderDetailKey, readOrderDetail } from './OrderDetailQuery';
import { OrderDrawerPanel } from './OrderDrawerPanel';
import { OrderIcon } from './OrderIcon';
import { formatOrderTime, fulfillmentLabel, fulfillmentTone, paymentLabel, paymentTone, previewRecord } from './OrderPresentation';
import { OrderPreviewAction } from './OrderPreviewAction';
import { OrderDetailTabSchema, type OrderDetailTab } from './OrderSchema';

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
  previewEnabled,
  onTab,
  onClose,
}: Readonly<{
  orderId: string;
  tab: OrderDetailTab;
  previewEnabled: boolean;
  onTab: (tab: OrderDetailTab) => void;
  onClose: () => void;
}>) {
  const context = useConsoleContext();
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: orderDetailKey(context, orderId),
    queryFn: ({ signal }) => readOrderDetail(context, orderId, signal),
    enabled: orderId !== '',
  });
  const detailCondition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: query.data !== undefined,
    empty: query.data === undefined && !query.isPending && query.error === null,
    stale: query.isStale,
  });
  const accessBlocked = detailCondition === 'unauthenticated' || detailCondition === 'denied';
  const order = accessBlocked ? undefined : query.data;
  const preview = order === undefined ? undefined : previewRecord(order, previewEnabled);
  const error = safeQueryError(query.error);

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
        <AriaDialog className="orderdrawer" aria-label={`订单详情 ${order?.order_number ?? orderId}`}>
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
                <span className="ordermutetext">内部订单 ID：{orderId}</span>
              ) : (
                <>
                  <div className="orderdrawerbadges">
                    <span className={`orderstatuspill tone-${paymentTone(order.payment_state)}`}>{paymentLabel(order.payment_state)}</span>
                    <span className={`orderstatuspill tone-${fulfillmentTone(order.fulfillment_state)}`}>{fulfillmentLabel(order.fulfillment_state)}</span>
                  </div>
                  <span className="ordermutetext">
                    {preview?.mallName ?? order.mall_id ?? '商城显示名不可用'} · {formatOrderTime(order.created_at)}
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
              const parsed = OrderDetailTabSchema.safeParse(key);
              if (parsed.success) onTab(parsed.data);
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
              {accessBlocked ? (
                <ResourceState condition={detailCondition} resourceLabel="订单详情" {...(error === undefined ? {} : { error })}>
                  <span />
                </ResourceState>
              ) : query.isError ? (
                <section className="orderdrawererror" role="alert">
                  <strong>订单详情读取失败</strong>
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void query.refetch();
                    }}
                  >
                    重试
                  </button>
                </section>
              ) : null}
              {!query.isPending && !query.isError && order === undefined ? (
                <section className="orderdrawerempty" role="status">
                  <strong>未找到订单</strong>
                  <p>当前详情读取只支持内部订单 ID 精确匹配，不支持使用展示订单号反查。</p>
                </section>
              ) : null}
              {order === undefined ? null : <OrderDrawerPanel order={order} tab={tab} previewEnabled={previewEnabled} />}
            </TabPanel>
          </Tabs>

          <footer className="orderdrawerfooter">
            <p id="orderactionboundary" className="sr-only">
              最终动作缺少权限版本重读、服务端预览、Step-up、action-bound proof 与 Operation 回执，当前保持关闭。
            </p>
            <button type="button" onClick={onClose}>
              关闭
            </button>
            <OrderPreviewAction
              ariaLabel="更多"
              title="更多订单操作"
              disabled={!previewEnabled || order === undefined}
              describedBy="orderactionboundary"
              placement="top end"
              triggerTitle={previewEnabled ? '打开更多订单操作预览' : '等待最终动作合同'}
              trigger="更多"
            >
              {(close) => (
                <div className="orderpreviewoptions">
                  <Button
                    type="button"
                    onPress={() => {
                      close();
                      onTab('operations');
                    }}
                  >
                    查看操作记录
                  </Button>
                </div>
              )}
            </OrderPreviewAction>
            <OrderPreviewAction
              ariaLabel="确认发货"
              title="确认发货预览"
              disabled={!previewEnabled || order === undefined}
              describedBy="orderactionboundary"
              placement="top end"
              triggerClassName="orderconfirmbutton"
              triggerTitle={previewEnabled ? '查看发货前安全校验' : '等待最终动作合同'}
              trigger={
                <>
                  <OrderIcon name="truck" />
                  确认发货
                </>
              }
            >
              {() => <p className="orderpreviewdetail">订单版本 {order?.version ?? '不可用'} 已读取；正式执行仍需 Preview → Confirm → Step-up → Execute → Reread → Receipt。</p>}
            </OrderPreviewAction>
          </footer>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
