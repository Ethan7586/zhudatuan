import { operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const reconciliationViewModel = defineSupplierViewModel({
  routes: ['supplierreconciliation'],
  title: '对账差异',
  description: '查看当前供应商对账差异及平台处理状态；复核和审批决定由平台完成。',
  read: (client, context) => client.finance.reconciliationsRead({ query: { limit: 50 } }, context),
  project: (value) =>
    operatorCollection(
      value,
      operatorItems(value).map((item) =>
        operatorRow({
          key: operatorText(item, 'id'),
          title: `${operatorText(item, 'provider')} · ${operatorText(item, 'period')}`,
          detail: `借方 ${money(item, 'debit_minor')} · 贷方 ${money(item, 'credit_minor')} · 差额 ${money(item, 'difference_minor')}`,
          statusLabel: reconciliationStatus(operatorText(item, 'state')),
          timestamp: operatorText(item, 'updated_at'),
        })
      )
    ),
});

function money(item: Parameters<typeof operatorText>[0], key: string): string {
  const value = operatorNumber(item, key);
  return value === undefined ? '待同步' : `¥${(value / 100).toFixed(2)}`;
}
function reconciliationStatus(value: string): string {
  if (value === 'matched' || value === 'approved' || value === 'completed') return '已完成';
  if (value === 'exception' || value === 'mismatched') return '存在差异';
  if (value === 'reviewing' || value === 'processing') return '平台处理中';
  return '等待平台处理';
}
