import { actionField, optionalText, requiredText, type OperatorAction } from '@shop/presentation/actions';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import {
  fulfillmentWorkStatus as workStatus,
  operatorCollection as displayCollection,
  operatorItems as dataItems,
  operatorNumber as recordNumber,
  operatorRow as displayRow,
  operatorText as recordText,
  selectedOperatorRecord as selectedRecord,
  type OperatorRecord as DataRecord,
} from '@shop/presentation/operator';

export const fulfillmentViewModel = defineStoreViewModel({
  routes: ['storefulfillment'],
  title: '发货管理',
  description: '扫描或输入物流单号后发货；服务端按履约版本防止重复发货和超量发货。',
  read: (client, context) => client.fulfillment.workitemsRead({ query: { limit: 50, state: ['accepted', 'processing', 'ready', 'needsaction'] } }, context),
  project: fulfillmentItems,
  actions: (value, _route, selectedKey) => shipmentActions(selectedRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    const item = selectedRecord(value, selectedKey);
    const version = item && recordNumber(item, 'version');
    if (action.id !== 'ship' || !item || version === undefined || !canShip(item)) throw new Error('当前任务不能发货，请刷新后核对履约状态。');
    const carrier = optionalText(input, 'carrier', 128);
    await client.fulfillment.shipmentsCreate(
      {
        path: { fulfillmentid: recordText(item, 'id') },
        body: { tracking: requiredText(input, 'tracking', 128), ...(carrier ? { carrier } : {}) },
      },
      { ...context, expectedVersion: version }
    );
    return { message: '发货成功，物流单号和操作员工已写入履约记录。' };
  },
});

function shipmentActions(item: DataRecord | undefined): readonly OperatorAction[] {
  if (!item || !canShip(item)) return Object.freeze([]);
  const version = recordNumber(item, 'version');
  if (version === undefined) return Object.freeze([]);
  return Object.freeze([
    Object.freeze({
      id: 'ship',
      label: '确认发货',
      description: '录入物流单号并发出当前履约单。',
      confirmation: '请核对包裹和物流单号；提交后不能以同一版本重复发货。',
      tone: 'primary',
      requiresSelection: true,
      expectedVersion: version,
      fields: Object.freeze([actionField('tracking', '物流单号', { kind: 'scan', maximumLength: 128 }), actionField('carrier', '承运商', { required: false, maximumLength: 128 })]),
    }),
  ]);
}

function canShip(item: DataRecord): boolean {
  return ['accepted', 'processing', 'ready'].includes(recordText(item, 'state')) && ['shipment', 'delivery'].includes(recordText(item, 'kind'));
}

function fulfillmentItems(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) =>
      displayRow({
        key: recordText(item, 'id'),
        title: `履约 ${recordText(item, 'order_number') || recordText(item, 'order_id')}`,
        detail: `${recordText(item, 'kind')} · ${packedSummary(item)}`,
        statusLabel: workStatus(recordText(item, 'state'), recordText(item, 'priority'), 'fulfillment'),
        timestamp: recordText(item, 'updated_at'),
      })
    )
  );
}

function packedSummary(item: DataRecord): string {
  const lines = Array.isArray(item.lines) ? (item.lines as DataRecord[]) : [];
  const totals = lines.reduce<{ packed: number; quantity: number }>((sum, line) => ({ packed: sum.packed + (recordNumber(line, 'packed') ?? 0), quantity: sum.quantity + (recordNumber(line, 'quantity') ?? 0) }), { packed: 0, quantity: 0 });
  return `已装 ${totals.packed}/${totals.quantity} 件`;
}
