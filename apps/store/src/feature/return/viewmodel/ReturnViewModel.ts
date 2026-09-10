import { actionField, optionalText, requiredText, type OperatorAction } from '@shop/presentation/actions';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import {
  operatorCollection as displayCollection,
  operatorItems as dataItems,
  operatorNumber as recordNumber,
  operatorRow as displayRow,
  operatorText as recordText,
  selectedOperatorRecord as selectedRecord,
  type OperatorRecord as DataRecord,
} from '@shop/presentation/operator';

export const returnViewModel = defineStoreViewModel({
  routes: ['storereturnwork'],
  title: '退货检验',
  description: '先确认退货到店，再记录检验结论；拒收必须填写原因，全部结果可追溯。',
  read: (client, context) => client.fulfillment.returnsRead({ query: { limit: 50, state: ['authorized', 'intransit', 'received'] } }, context),
  project: returnItems,
  actions: (value, _route, selectedKey) => returnActions(selectedRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    const item = selectedRecord(value, selectedKey);
    const version = item && recordNumber(item, 'version');
    if (!item || version === undefined) throw new Error('请选择一条待处理退货记录。');
    const request = { path: { returnid: recordText(item, 'id') } } as const;
    if (action.id === 'receive' && ['authorized', 'intransit'].includes(recordText(item, 'state'))) {
      const tracking = optionalText(input, 'tracking', 128);
      await client.fulfillment.returnsReceive({ ...request, body: { ...(tracking === undefined ? {} : { tracking }) } }, { ...context, expectedVersion: version });
      return { message: '退货已确认到店，可以继续进行商品检验。' };
    }
    if ((action.id === 'accept' || action.id === 'reject') && recordText(item, 'state') === 'received') {
      const note = action.id === 'reject' ? requiredText(input, 'note', 1000) : optionalText(input, 'note', 1000);
      await client.fulfillment.returnsInspect({ ...request, body: { accepted: action.id === 'accept', ...(note === undefined ? {} : { inspection: { note } }) } }, { ...context, expectedVersion: version });
      return { message: action.id === 'accept' ? '检验通过，退货结果已记录。' : '检验未通过，原因已记录并进入后续协同。' };
    }
    throw new Error('退货状态已变化，请刷新后重新操作。');
  },
});

function returnActions(item: DataRecord | undefined): readonly OperatorAction[] {
  if (!item) return Object.freeze([]);
  const state = recordText(item, 'state');
  const version = recordNumber(item, 'version');
  if (version === undefined) return Object.freeze([]);
  if (state === 'authorized' || state === 'intransit')
    return Object.freeze([operation('receive', '确认到店', '确认退货包裹已到达门店。', version, [actionField('tracking', '退货物流单号', { kind: 'scan', required: false, maximumLength: 128 })])]);
  if (state !== 'received') return Object.freeze([]);
  return Object.freeze([
    operation('accept', '检验通过', '商品符合退货验收标准。', version, [actionField('note', '检验备注', { kind: 'textarea', required: false, maximumLength: 1000 })]),
    operation('reject', '检验不通过', '记录不通过原因并转入协同。', version, [actionField('note', '不通过原因', { kind: 'textarea', maximumLength: 1000 })], 'danger'),
  ]);
}

function operation(id: string, label: string, description: string, expectedVersion: number, fields: readonly ReturnType<typeof actionField>[], tone: 'primary' | 'danger' = 'primary'): OperatorAction {
  return Object.freeze({ id, label, description, confirmation: `${description}提交后将绑定当前员工和门店。`, tone, requiresSelection: true, expectedVersion, fields: Object.freeze([...fields]) });
}

function returnItems(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) =>
      displayRow({
        key: recordText(item, 'id'),
        title: `退货 ${recordText(item, 'order_number') || recordText(item, 'aftersale_id')}`,
        detail: `${recordText(item, 'member_masked')} · ${lineCount(item)} 个退货明细`,
        statusLabel: returnStatus(recordText(item, 'state')),
        timestamp: recordText(item, 'updated_at'),
      })
    )
  );
}

function lineCount(item: DataRecord): number {
  return Array.isArray(item.lines) ? item.lines.length : 0;
}

function returnStatus(state: string): string {
  if (state === 'authorized') return '待收货';
  if (state === 'intransit') return '退货运输中';
  if (state === 'received') return '待检验';
  if (state === 'accepted') return '检验通过';
  return state === 'rejected' ? '检验未通过' : '待处理';
}
