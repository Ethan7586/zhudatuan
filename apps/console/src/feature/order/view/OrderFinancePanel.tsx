import { chineseDomainLabel } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { OrderDetail, OrderFinance } from '../model/Order';
import { OrderDetailInfo, OrderDetailSection, OrderSectionState } from './OrderDetailSection';

export function OrderFinancePanel({ order, onRetry }: Readonly<{ order: OrderDetail; onRetry: (() => void) | undefined }>) {
  const section = order.sections.finance;
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="订单财务核对">
        <OrderSectionState section={section} title="财务摘要" onRetry={onRetry} />
        {section.state === 'ready' ? (
          <div className="orderdetailgrid">
            <OrderDetailInfo label="订单应付" value={formatMinor(section.data.grossMinor, section.data.currency)} />
            <OrderDetailInfo label="已捕获资金" value={formatMinor(section.data.capturedMinor, section.data.currency)} />
            <OrderDetailInfo label="已退款" value={formatMinor(section.data.refundedMinor, section.data.currency)} />
            <OrderDetailInfo label="净收款" value={formatMinor(section.data.netMinor, section.data.currency)} />
            <OrderDetailInfo label="待支付差额" value={formatMinor(section.data.outstandingMinor, section.data.currency)} />
            <OrderDetailInfo label="核对状态" value={financeLabel(section.data.state)} />
            <OrderDetailInfo label="来源核验" value={chineseDomainLabel(section.data.verificationState)} />
            <OrderDetailInfo label="数据水位" value={formatDate(section.data.watermark)} />
          </div>
        ) : null}
      </OrderDetailSection>
    </div>
  );
}

function financeLabel(state: OrderFinance['state']): string {
  return ({ pending: '等待支付事实', balanced: '金额已核平', partialrefund: '存在部分退款', refunded: '已全额退款', attention: '需要财务核对' } as const)[state];
}
