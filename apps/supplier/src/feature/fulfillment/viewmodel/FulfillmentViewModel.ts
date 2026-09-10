import { actionField, optionalText, requiredText, type OperatorAction } from '@shop/presentation/actions';
import { fulfillmentWorkStatus, operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText, selectedOperatorRecord, type OperatorRecord } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const fulfillmentViewModel = defineSupplierViewModel({
  routes: ['suppliershipments'],
  title: '发货管理',
  description: '扫描或输入物流单号完成供应商发货；平台按履约版本阻止重复和超量发货。',
  read: (client, context) => client.fulfillment.workitemsRead({ query: { limit: 50, state: ['accepted', 'processing', 'ready', 'needsaction'] } }, context),
  project: shipmentProjection,
  actions: (value, _route, selectedKey) => shipmentActions(selectedOperatorRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    const item = selectedOperatorRecord(value, selectedKey);
    const version = item && operatorNumber(item, 'version');
    if (action.id !== 'ship' || !item || version === undefined || !canShip(item)) throw new Error('当前履约任务不能发货，请刷新后核对状态。');
    const carrier = optionalText(input, 'carrier', 128);
    await client.fulfillment.shipmentsCreate(
      {
        path: { fulfillmentid: operatorText(item, 'id') },
        body: { tracking: requiredText(input, 'tracking', 128), ...(carrier ? { carrier } : {}) },
      },
      { ...context, expectedVersion: version }
    );
    return { message: '发货成功，物流单号和供应商操作人员已写入平台履约记录。' };
  },
});

function shipmentActions(item: OperatorRecord | undefined): readonly OperatorAction[] {
  const version = item && operatorNumber(item, 'version');
  if (!item || version === undefined || !canShip(item)) return Object.freeze([]);
  return Object.freeze([
    Object.freeze({
      id: 'ship',
      label: '确认发货',
      description: '录入承运商和物流单号，发出当前履约单。',
      confirmation: '请核对包裹与物流信息；同一履约版本不能重复提交。',
      tone: 'primary',
      requiresSelection: true,
      expectedVersion: version,
      fields: Object.freeze([actionField('tracking', '物流单号', { kind: 'scan', maximumLength: 128 }), actionField('carrier', '承运商', { required: false, maximumLength: 128 })]),
    }),
  ]);
}

function canShip(item: OperatorRecord): boolean {
  return ['accepted', 'processing', 'ready'].includes(operatorText(item, 'state')) && ['shipment', 'delivery'].includes(operatorText(item, 'kind'));
}

function shipmentProjection(value: unknown) {
  return operatorCollection(
    value,
    operatorItems(value).map((item) =>
      operatorRow({
        key: operatorText(item, 'id'),
        title: `履约 ${operatorText(item, 'order_number') || operatorText(item, 'order_id')}`,
        detail: `${routeLabel(operatorText(item, 'kind'))} · ${packedSummary(item)}`,
        statusLabel: fulfillmentWorkStatus(operatorText(item, 'state'), operatorText(item, 'priority'), 'fulfillment'),
        timestamp: operatorText(item, 'updated_at'),
      })
    )
  );
}

function packedSummary(item: OperatorRecord): string {
  const lines = Array.isArray(item.lines) ? (item.lines as readonly OperatorRecord[]) : [];
  const total = lines.reduce<{ packed: number; quantity: number }>((sum, line) => ({ packed: sum.packed + (operatorNumber(line, 'packed') ?? 0), quantity: sum.quantity + (operatorNumber(line, 'quantity') ?? 0) }), {
    packed: 0,
    quantity: 0,
  });
  return `已装 ${total.packed}/${total.quantity} 件`;
}

function routeLabel(value: string): string {
  return value === 'delivery' ? '配送' : value === 'shipment' ? '快递发货' : '履约';
}
