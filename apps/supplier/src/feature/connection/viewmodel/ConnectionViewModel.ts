import type { OperatorAction } from '@shop/presentation/actions';
import { operatorCollection, operatorItems, operatorNumber, operatorRow, operatorText, selectedOperatorRecord, type OperatorRecord } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const connectionViewModel = defineSupplierViewModel({
  routes: ['supplierconnections'], title: '接口与渠道连接', description: '查看当前供应商连接健康状态并发起安全测试；密钥和平台连接配置不可见。',
  read: (client, context) => client.channel.connectionsRead({ query: { limit: 50 } }, context),
  project: connectionProjection,
  actions: (value, _route, selectedKey) => connectionActions(selectedOperatorRecord(value, selectedKey)),
  execute: async (client, context, _route, value, selectedKey, action) => {
    const item = selectedOperatorRecord(value, selectedKey);
    const version = item && operatorNumber(item, 'version');
    if (action.id !== 'test' || !item || version === undefined) throw new Error('连接版本已变化，请刷新后重试。');
    await client.channel.connectionsTest({ path: { connectionid: operatorText(item, 'id') }, body: {} }, { ...context, expectedVersion: version });
    return { message: '连接测试已启动，请稍后刷新查看最新延迟和健康状态。' };
  },
});

function connectionActions(item: OperatorRecord | undefined): readonly OperatorAction[] {
  const version = item && operatorNumber(item, 'version');
  if (!item || version === undefined || operatorText(item, 'status') === 'disabled') return Object.freeze([]);
  return Object.freeze([Object.freeze({
    id: 'test', label: '测试连接', description: '使用平台托管密钥验证当前接口可用性。', confirmation: '测试不会展示或修改密钥，仅记录健康结果。',
    tone: 'primary', requiresSelection: true, identityScope: true, expectedVersion: version, fields: Object.freeze([]),
  })]);
}

function connectionProjection(value: unknown) {
  return operatorCollection(value, operatorItems(value).map((item) => operatorRow({
    key: operatorText(item, 'id'), title: `${operatorText(item, 'provider')} · ${operatorText(item, 'region')}`,
    detail: `${latency(operatorNumber(item, 'health_latency_ms'))} · ${operatorText(item, 'health_reason') || '最近检查无异常说明'}`,
    statusLabel: healthStatus(operatorText(item, 'health_state'), operatorText(item, 'status')), timestamp: operatorText(item, 'checked_at') || operatorText(item, 'updated_at'),
  })));
}

function latency(value: number | undefined): string { return value === undefined ? '延迟待检测' : `延迟 ${value} 毫秒`; }
function healthStatus(health: string, state: string): string {
  if (state === 'disabled') return '连接已停用';
  if (health === 'healthy') return '连接正常';
  if (health === 'degraded') return '连接性能下降';
  if (health === 'unhealthy') return '连接不可用';
  return state === 'testing' ? '正在测试' : '等待健康检查';
}
