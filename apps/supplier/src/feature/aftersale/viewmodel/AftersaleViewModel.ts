import { actionField, optionalText, requiredText, type OperatorAction } from '@shop/presentation/actions';
import { operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText, selectedOperatorRecord, type OperatorRecord } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const aftersaleViewModel = defineSupplierViewModel({
  routes: ['supplierreturns'],
  title: '退货收货与质检',
  description: '先确认退货到仓，再提交质检证据；退款和平台审批决定始终由平台负责。',
  read: (client, context) => client.fulfillment.returnsRead({ query: { limit: 50, state: ['authorized', 'intransit', 'received'] } }, context),
  project: returnProjection,
  actions: (value, _route, selectedKey) => returnActions(selectedOperatorRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    const item = selectedOperatorRecord(value, selectedKey);
    const version = item && operatorNumber(item, 'version');
    if (!item || version === undefined) throw new Error('请选择一条待处理退货记录。');
    const request = { path: { returnid: operatorText(item, 'id') } } as const;
    if (action.id === 'receive' && ['authorized', 'intransit'].includes(operatorText(item, 'state'))) {
      const tracking = optionalText(input, 'tracking', 128);
      await client.fulfillment.returnsReceive({ ...request, body: { ...(tracking ? { tracking } : {}) } }, { ...context, expectedVersion: version });
      return { message: '退货已确认到仓，可以继续提交质检结论。' };
    }
    if ((action.id === 'accept' || action.id === 'reject') && operatorText(item, 'state') === 'received') {
      const note = action.id === 'reject' ? requiredText(input, 'note', 1000) : optionalText(input, 'note', 1000);
      await client.fulfillment.returnsInspect({ ...request, body: { accepted: action.id === 'accept', ...(note ? { inspection: { note } } : {}) } }, { ...context, expectedVersion: version });
      return { message: action.id === 'accept' ? '质检通过，平台已记录供应商结论。' : '质检未通过，原因已记录并转入平台售后协同。' };
    }
    throw new Error('退货状态已变化，请刷新后重新操作。');
  },
});

function returnActions(item: OperatorRecord | undefined): readonly OperatorAction[] {
  if (!item) return Object.freeze([]);
  const state = operatorText(item, 'state');
  const version = operatorNumber(item, 'version');
  if (version === undefined) return Object.freeze([]);
  if (state === 'authorized' || state === 'intransit')
    return Object.freeze([operation('receive', '确认到仓', '确认供应商仓库已收到退货包裹。', version, [actionField('tracking', '退货物流单号', { kind: 'scan', required: false, maximumLength: 128 })])]);
  if (state !== 'received') return Object.freeze([]);
  return Object.freeze([
    operation('accept', '质检通过', '商品符合退货验收标准。', version, [actionField('note', '质检备注', { kind: 'textarea', required: false, maximumLength: 1000 })]),
    operation('reject', '质检不通过', '提交不通过原因供平台处理。', version, [actionField('note', '不通过原因', { kind: 'textarea', maximumLength: 1000 })], 'danger'),
  ]);
}

function operation(id: string, label: string, description: string, expectedVersion: number, fields: readonly ReturnType<typeof actionField>[], tone: 'primary' | 'danger' = 'primary'): OperatorAction {
  return Object.freeze({ id, label, description, confirmation: `${description}提交后会记录当前供应商操作人员。`, tone, requiresSelection: true, expectedVersion, fields: Object.freeze([...fields]) });
}

function returnProjection(value: unknown) {
  return operatorCollection(
    value,
    operatorItems(value).map((item) =>
      operatorRow({
        key: operatorText(item, 'id'),
        title: `退货 ${operatorText(item, 'order_number') || operatorText(item, 'aftersale_id')}`,
        detail: `${operatorText(item, 'member_masked')} · ${Array.isArray(item.lines) ? item.lines.length : 0} 个退货明细`,
        statusLabel: returnStatus(operatorText(item, 'state')),
        timestamp: operatorText(item, 'updated_at'),
      })
    )
  );
}

function returnStatus(value: string): string {
  if (value === 'authorized') return '待收货';
  if (value === 'intransit') return '退货运输中';
  if (value === 'received') return '待质检';
  if (value === 'accepted') return '质检通过';
  return value === 'rejected' ? '质检未通过' : '待处理';
}
