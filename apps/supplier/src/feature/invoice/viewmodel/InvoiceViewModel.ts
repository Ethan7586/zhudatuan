import { operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const invoiceViewModel = defineSupplierViewModel({
  routes: ['supplierinvoice'],
  title: '发票协同',
  description: '查看供应商结算对应的发票申请、开具和红票状态；审批决定由平台负责。',
  read: (client, context) => client.invoice.requestsRead({ query: { limit: 50 } }, context),
  project: (value) =>
    operatorCollection(
      value,
      operatorItems(value).map((item) =>
        operatorRow({
          key: operatorText(item, 'id'),
          title: `${operatorText(item, 'kind') === 'red' ? '红字发票' : '发票申请'} · ${money(operatorNumber(item, 'amount_minor'))}`,
          detail: `${operatorText(item, 'provider') || '开票服务商待分配'} · ${operatorText(item, 'provider_reference') || '服务商流水待生成'}`,
          statusLabel: invoiceStatus(operatorText(item, 'state')),
          timestamp: operatorText(item, 'issued_at') || operatorText(item, 'created_at'),
        })
      )
    ),
});

function money(value: number | undefined): string {
  return value === undefined ? '金额待同步' : `¥${(value / 100).toFixed(2)}`;
}
function invoiceStatus(value: string): string {
  if (value === 'issued' || value === 'completed') return '已开具';
  if (value === 'rejected' || value === 'failed') return '开具失败';
  if (value === 'cancelled') return '已取消';
  return '处理中';
}
