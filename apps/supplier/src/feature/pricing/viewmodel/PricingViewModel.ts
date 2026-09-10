import { actionField, requiredMoneyMinor, type OperatorAction } from '@shop/presentation/actions';
import { operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText, selectedOperatorRecord, type OperatorRecord } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const pricingViewModel = defineSupplierViewModel({
  routes: ['supplierpricing'],
  title: '价格管理',
  description: '只维护当前供应商商品报价；金额和版本以平台主线事实为准。',
  read: (client, context) => client.catalog.listingsRead({ query: { limit: 50 } }, context),
  project: priceProjection,
  actions: (value, _route, selectedKey) => priceActions(selectedOperatorRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    const item = selectedOperatorRecord(value, selectedKey);
    const version = item ? (operatorNumber(item, 'price_version') ?? 0) : undefined;
    if (action.id !== 'price' || !item || !operatorText(item, 'sku_id') || version === undefined) throw new Error('该商品尚未映射可报价库存单位，或价格版本已变化。');
    await client.catalog.listingsPriceSet({ path: { listingid: operatorText(item, 'id') }, body: { amountMinor: requiredMoneyMinor(input, 'amount') } }, { ...context, expectedVersion: version });
    return { message: '报价已保存，平台已生成新的价格版本。' };
  },
});

function priceActions(item: OperatorRecord | undefined): readonly OperatorAction[] {
  if (!item || !operatorText(item, 'sku_id')) return Object.freeze([]);
  const current = operatorNumber(item, 'price_amount_minor');
  const version = operatorNumber(item, 'price_version') ?? 0;
  return Object.freeze([
    Object.freeze({
      id: 'price',
      label: current === undefined ? '设置报价' : '更新报价',
      description: '输入含税人民币单价，服务端按价格版本防止覆盖。',
      confirmation: '请核对商品和报价；提交后平台将立即记录新版本。',
      tone: 'primary',
      requiresSelection: true,
      expectedVersion: version,
      fields: Object.freeze([actionField('amount', '含税单价（元）', { kind: 'number', value: current === undefined ? '' : (current / 100).toFixed(2) })]),
    }),
  ]);
}

function priceProjection(value: unknown) {
  return operatorCollection(
    value,
    operatorItems(value).map((item) =>
      operatorRow({
        key: operatorText(item, 'id'),
        title: operatorText(item, 'title'),
        detail: `${operatorText(item, 'code') || '编码待映射'} · ${priceLabel(operatorNumber(item, 'price_amount_minor'))}`,
        statusLabel: operatorText(item, 'sku_id') ? '可维护报价' : '等待商品映射',
        timestamp: operatorText(item, 'cursor_sort'),
      })
    )
  );
}

function priceLabel(value: number | undefined): string {
  return value === undefined ? '尚未报价' : `当前报价 ¥${(value / 100).toFixed(2)}`;
}
