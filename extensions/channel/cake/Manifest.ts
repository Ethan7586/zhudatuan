import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'cake',
  name: '蛋糕（元祖、幸福西饼、家有熊猫、帕瑞斯、窝夫小子、甜风集、味多美、味之初、维尔纳斯、窝家甜品、星期六、蜜时cake、诺心、米卡米卡、榴芒一刻、积慕cake、映悦、香缇蜜语、爱在此客、喜芙来、皇冠幸福里、焙福谷……）',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'cake.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog', 'GeoStore', 'TimeSlot', 'Order', 'Cancel', 'Delivery', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.cake.operate'],
  configSchema: 'provider.cake.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.cake.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.cake.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('CAKE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
