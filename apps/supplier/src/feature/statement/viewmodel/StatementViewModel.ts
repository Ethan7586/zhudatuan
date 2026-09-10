import { operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const statementViewModel = defineSupplierViewModel({
  routes: ['supplierstatements'],
  title: '对账账单',
  description: '查看当前供应商范围的账期、收支和期末金额；平台总账不可修改。',
  read: (client, context) => client.finance.statementsRead({ query: { limit: 50 } }, context),
  project: (value) =>
    operatorCollection(
      value,
      operatorItems(value).map((item) =>
        operatorRow({
          key: operatorText(item, 'id'),
          title: `${operatorText(item, 'period_start')} 至 ${operatorText(item, 'period_end')}`,
          detail: `收入 ${money(operatorNumber(item, 'credit_minor'))} · 支出 ${money(operatorNumber(item, 'debit_minor'))} · 期末 ${money(operatorNumber(item, 'closing_minor'))}`,
          statusLabel: operatorText(item, 'state') === 'final' ? '账单已确认' : '账单草稿',
          timestamp: operatorText(item, 'generated_at'),
        })
      )
    ),
});

function money(value: number | undefined): string {
  return value === undefined ? '待同步' : `¥${(value / 100).toFixed(2)}`;
}
