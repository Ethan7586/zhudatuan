import type { OperationOutputFor } from '@shop/contract';

type ProviderDto = OperationOutputFor<'identity.providers.read'>['items'][number];
export interface Provider {
  readonly id: string;
  readonly type: ProviderDto['type'];
}

export interface FederationRedirect {
  readonly redirectUrl: string;
}

const PROVIDER_LABELS: Readonly<Record<Provider['type'], string>> = Object.freeze({
  wechat: '微信',
  wecomcorp: '企业微信',
  wecomsuite: '企业微信服务商',
  oidc: '企业单点登录',
});

export function providerLabel(type: Provider['type'], action?: 'login' | 'link'): string {
  const label = PROVIDER_LABELS[type];
  if (action === 'login') return label.endsWith('登录') ? label : `${label}登录`;
  if (action === 'link') return `绑定${label}`;
  return label;
}
