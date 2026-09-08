import { actionField, optionalText, type OperatorAction } from '@shop/presentation/actions';
import { fulfillmentWorkStatus, operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText, selectedOperatorRecord, type OperatorRecord } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

const transitions = Object.freeze({
  submitted: ['accept', '接单', '确认由当前供应商承接订单。'],
  accepted: ['prepare', '开始备货', '进入备货状态。'],
  processing: ['ready', '备货完成', '确认商品已备齐并可发货。'],
} as const);

export const orderViewModel = defineSupplierViewModel({
  routes: ['supplierorders'],
  title: '订单确认与备货',
  description: '逐单执行接单和备货，状态与版本由平台统一校验，不能覆盖其他履约方记录。',
  read: (client, context) => client.fulfillment.workitemsRead({ query: { limit: 50, state: ['submitted', 'accepted', 'processing', 'needsaction'] } }, context),
  project: orderProjection,
  actions: (value, _route, selectedKey) => orderActions(selectedOperatorRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    const item = selectedOperatorRecord(value, selectedKey);
    const next = item && nextAction(item);
    const version = item && operatorNumber(item, 'version');
    if (!item || !next || version === undefined || next.id !== action.id) throw new Error('订单状态已变化，请刷新后重新选择。');
    const note = optionalText(input, 'note', 1000);
    await client.fulfillment.workitemsTransition({
      path: { fulfillmentid: operatorText(item, 'id') }, body: { action: next.operation, ...(note ? { note } : {}) },
    }, { ...context, expectedVersion: version });
    return { message: `${next.label}成功，平台履约状态已同步更新。` };
  },
});

function orderActions(item: OperatorRecord | undefined): readonly OperatorAction[] {
  const next = item && nextAction(item);
  return next ? Object.freeze([next]) : Object.freeze([]);
}

function nextAction(item: OperatorRecord): (OperatorAction & Readonly<{ operation: 'accept' | 'prepare' | 'ready' }>) | undefined {
  const configured = transitions[operatorText(item, 'state') as keyof typeof transitions];
  const version = operatorNumber(item, 'version');
  if (!configured || version === undefined) return undefined;
  return Object.freeze({
    id: configured[0], operation: configured[0], label: configured[1], description: configured[2],
    confirmation: `${configured[2]}提交后会记录当前操作人员和供应商。`, tone: 'primary', requiresSelection: true, identityScope: true, expectedVersion: version,
    fields: Object.freeze([actionField('note', '操作备注', { kind: 'textarea', required: false, maximumLength: 1000 })]),
  });
}

function orderProjection(value: unknown) {
  return operatorCollection(value, operatorItems(value).map((item) => operatorRow({
    key: operatorText(item, 'id'), title: `订单 ${operatorText(item, 'order_number') || operatorText(item, 'order_id')}`,
    detail: `${operatorText(item, 'member_masked')} · ${lineSummary(item)}`,
    statusLabel: fulfillmentWorkStatus(operatorText(item, 'state'), operatorText(item, 'priority'), 'order'), timestamp: operatorText(item, 'updated_at'),
  })));
}

function lineSummary(item: OperatorRecord): string {
  const lines = Array.isArray(item.lines) ? (item.lines as readonly OperatorRecord[]) : [];
  const quantity = lines.reduce((total, line) => total + (operatorNumber(line, 'quantity') ?? 0), 0);
  return `${lines.length} 种商品，共 ${quantity} 件`;
}
