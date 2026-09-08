import { actionField, optionalText, type OperatorAction } from '@shop/presentation/actions';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import { fulfillmentWorkStatus as workStatus, operatorCollection as displayCollection, operatorItems as dataItems, operatorNumber as recordNumber, operatorRow as displayRow, operatorText as recordText, selectedOperatorRecord as selectedRecord, type OperatorRecord as DataRecord } from '@shop/presentation/operator';

const transition = Object.freeze({ submitted: ['accept', '接单', '确认由当前门店接单。'], accepted: ['prepare', '开始备货', '进入备货状态。'], processing: ['ready', '备货完成', '确认商品已备齐。'] } as const);

export const orderViewModel = defineStoreViewModel({
  routes: ['storeorderswork', 'storeorderwork'],
  title: '接单与备货',
  description: '逐单选择后只显示当前可执行的下一步，所有确认均由服务端校验状态和版本。',
  read: (client, context, route) =>
    route.id === 'storeorderwork'
      ? client.order.detailRead({ path: { orderid: route.parameters.orderId } }, context)
      : client.fulfillment.workitemsRead({ query: { limit: 50, state: ['submitted', 'accepted', 'processing', 'ready', 'needsaction'] } }, context),
  project: (value, route) => (route.id === 'storeorderwork' ? orderDetail(value) : workItems(value)),
  actions: (value, route, selectedKey) => (route.id === 'storeorderswork' ? orderActions(selectedRecord(value, selectedKey)) : []),
  execute: async (client, context, route, value, selectedKey, action, input) => {
    if (route.id !== 'storeorderswork') throw new Error('订单详情仅供核对，请返回接单与备货列表操作。');
    const item = selectedRecord(value, selectedKey);
    const version = item && recordNumber(item, 'version');
    const expected = item && nextAction(item);
    if (!item || version === undefined || expected?.id !== action.id) throw new Error('订单状态已变化，请刷新后重新选择。');
    const note = optionalText(input, 'note', 1000);
    await client.fulfillment.workitemsTransition(
      {
        path: { fulfillmentid: recordText(item, 'id') },
        body: { action: expected.operation, ...(note === undefined ? {} : { note }) },
      },
      { ...context, expectedVersion: version }
    );
    return { message: `${expected.label}成功，任务状态已由服务端更新。` };
  },
});

function orderActions(item: DataRecord | undefined): readonly OperatorAction[] {
  const next = item && nextAction(item);
  return next ? Object.freeze([next]) : Object.freeze([]);
}

type WorkAction = (typeof transition)[keyof typeof transition][0] | 'complete';

function nextAction(item: DataRecord): (OperatorAction & Readonly<{ operation: WorkAction }>) | undefined {
  const state = recordText(item, 'state');
  const configured = transition[state as keyof typeof transition];
  const complete = state === 'ready' && recordText(item, 'kind') !== 'shipment' ? (['complete', '确认交付', '确认顾客已取货或服务已完成。'] as const) : undefined;
  const selected = configured ?? complete;
  const version = recordNumber(item, 'version');
  if (!selected || version === undefined) return undefined;
  return Object.freeze({
    id: selected[0],
    operation: selected[0],
    label: selected[1],
    description: selected[2],
    confirmation: `${selected[2]}提交后将记录当前员工和门店。`,
    tone: 'primary',
    requiresSelection: true,
    identityScope: true,
    expectedVersion: version,
    fields: Object.freeze([actionField('note', '操作备注', { kind: 'textarea', required: false, maximumLength: 1000 })]),
  });
}

function workItems(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) =>
      displayRow({
        key: recordText(item, 'id'),
        title: `订单 ${recordText(item, 'order_number') || recordText(item, 'order_id')}`,
        detail: `${recordText(item, 'member_masked')} · ${lineSummary(item)}`,
        statusLabel: workStatus(recordText(item, 'state'), recordText(item, 'priority'), 'order'),
        timestamp: recordText(item, 'updated_at'),
      })
    )
  );
}

function orderDetail(value: unknown) {
  const item = value && typeof value === 'object' && !Array.isArray(value) ? (value as DataRecord) : {};
  const id = recordText(item, 'id') || recordText(item, 'number');
  return displayCollection(
    value,
    id ? [displayRow({ key: id, title: `订单 ${recordText(item, 'number') || id}`, detail: '订单、支付和履约明细已从服务端同步。', status: recordText(item, 'state'), timestamp: recordText(item, 'updated_at') })] : []
  );
}

function lineSummary(item: DataRecord): string {
  const lines = item.lines;
  if (!Array.isArray(lines)) return '商品明细待同步';
  const quantity = lines.reduce((sum, line) => sum + (typeof (line as DataRecord)?.quantity === 'number' ? Number((line as DataRecord).quantity) : 0), 0);
  return `${lines.length} 种商品，共 ${quantity} 件`;
}
