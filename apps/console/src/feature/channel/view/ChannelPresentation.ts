import { chineseProviderLabel } from '@shop/presentation';
import type { ChannelConnection } from '../model/Channel';

const regions: Readonly<Record<string, string>> = Object.freeze({
  cn: '中国大陆',
  china: '中国大陆',
  global: '全球',
  hk: '中国香港',
  overseas: '海外',
});

export function channelRegionLabel(region: string): string {
  return regions[region.toLowerCase()] ?? '已配置服务区域';
}

export function channelConnectionLabel(connection: Pick<ChannelConnection, 'provider' | 'region'>): string {
  return `${chineseProviderLabel(connection.provider)} · ${channelRegionLabel(connection.region)}`;
}

const healthMessages: Readonly<Record<string, string>> = Object.freeze({
  CIRCUIT_OPEN: '该服务商的保护机制已暂时断开请求，请稍后重新测试。',
  HEALTH_CHECK_FAILED: '该服务商健康检查未通过，请核对连接配置后重新测试。',
  PROVIDER_STOPPED: '该服务商连接当前未启用。',
  PROVIDER_TIMEOUT: '该服务商响应超时，其他渠道不受影响。',
});

export function channelHealthDetail(health: ChannelConnection['health']): string {
  if (health.reason) return healthMessages[health.reason] ?? '该服务商当前不可用；错误已隔离，其他渠道仍可继续使用。';
  if (health.latencyMs !== null) return `响应 ${health.latencyMs} 毫秒`;
  return health.checkedAt ? '已完成健康检查' : '尚未执行健康检查';
}

export function channelHealthFailed(health: ChannelConnection['health']): boolean {
  return health.state === 'degraded' || health.state === 'unhealthy';
}
