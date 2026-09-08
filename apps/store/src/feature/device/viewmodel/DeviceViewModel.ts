import { actionField, requiredText, type OperatorAction } from '@shop/presentation/actions';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import { operatorCollection as displayCollection, operatorItems as dataItems, operatorNumber as recordNumber, operatorRow as displayRow, operatorText as recordText, selectedOperatorRecord as selectedRecord, type OperatorRecord as DataRecord } from '@shop/presentation/operator';

const register = Object.freeze({
  id: 'register',
  label: '登记设备',
  description: '将扫码枪、平板或收银设备绑定到当前门店。',
  confirmation: '仅登记由门店管理的设备；设备码不会在页面回显。',
  tone: 'primary',
  identityScope: true,
  expectedVersion: 0,
  fields: Object.freeze([actionField('id', '设备编号', { kind: 'scan', maximumLength: 128 }), actionField('label', '设备名称', { maximumLength: 120 }), actionField('fingerprint', '设备码', { kind: 'password', maximumLength: 512 })]),
} as const);

export const deviceViewModel = defineStoreViewModel({
  routes: ['storedevices'],
  title: '设备与人员',
  description: '登记并管理当前门店可信设备；核销必须同时绑定门店、员工和可信设备。',
  read: (client, context) => client.verification.devicesRead({ query: { limit: 50 } }, context),
  project: deviceProjection,
  actions: (value, _route, selectedKey) => deviceActions(selectedRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    const selected = selectedRecord(value, selectedKey);
    const creating = action.id === 'register';
    const status = action.id === 'block' ? 'blocked' : action.id === 'retire' ? 'retired' : 'trusted';
    if (!creating && !selected) throw new Error('请选择一台已登记设备。');
    const id = creating ? requiredText(input, 'id', 128) : recordText(selected!, 'id');
    const version = creating ? 0 : recordNumber(selected!, 'version');
    if (version === undefined) throw new Error('设备版本无效，请刷新后重试。');
    await client.verification.devicesManage({ path: { deviceid: id }, body: { label: requiredText(input, 'label', 120), fingerprint: requiredText(input, 'fingerprint', 512), status } }, { ...context, expectedVersion: version });
    return { message: creating ? '设备已登记并绑定当前门店。' : `设备已更新为${status === 'trusted' ? '可信' : status === 'blocked' ? '停用' : '退役'}状态。` };
  },
});

function deviceActions(item: DataRecord | undefined): readonly OperatorAction[] {
  if (!item) return Object.freeze([register]);
  const version = recordNumber(item, 'version');
  if (version === undefined || recordText(item, 'status') === 'retired') return Object.freeze([register]);
  const status = recordText(item, 'status');
  const next =
    status === 'trusted'
      ? [stateAction('block', '停用设备', '立即禁止该设备继续核销。', item, version, 'danger'), stateAction('retire', '设备退役', '永久结束该设备的门店使用。', item, version, 'danger')]
      : [stateAction('trust', '恢复可信', '重新允许该设备执行核销。', item, version, 'primary'), stateAction('retire', '设备退役', '永久结束该设备的门店使用。', item, version, 'danger')];
  return Object.freeze([register, ...next]);
}

function stateAction(id: string, label: string, description: string, item: DataRecord, expectedVersion: number, tone: 'primary' | 'danger'): OperatorAction {
  return Object.freeze({
    id,
    label,
    description,
    confirmation: `${description}提交前请再次输入设备码。`,
    tone,
    identityScope: true,
    requiresSelection: true,
    expectedVersion,
    fields: Object.freeze([actionField('label', '设备名称', { maximumLength: 120, value: recordText(item, 'label') }), actionField('fingerprint', '设备码', { kind: 'password', maximumLength: 512 })]),
  });
}

function deviceProjection(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) =>
      displayRow({ key: recordText(item, 'id'), title: recordText(item, 'label'), detail: `设备 ${recordText(item, 'id')}`, statusLabel: deviceStatus(recordText(item, 'status')), timestamp: recordText(item, 'last_used_at') })
    )
  );
}

function deviceStatus(value: string): string {
  if (value === 'trusted') return '可信设备';
  if (value === 'blocked') return '已停用';
  return value === 'retired' ? '已退役' : '状态待确认';
}
