import { PROVIDER_REQUIREMENTS } from '@shop/contract';

const providerLabels = Object.freeze(Object.fromEntries(PROVIDER_REQUIREMENTS.map(({ id, label }) => [id, label])) as Readonly<Record<string, string>>);
const paymentProviderLabels: Readonly<Record<string, string>> = Object.freeze({ wechat: '微信支付', wechatpay: '微信支付', wechat_pay: '微信支付', alipay: '支付宝', unionpay: '银联支付' });

export function chineseProviderLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') return '—';
  const key = value.trim().toLowerCase();
  return providerLabels[key] ?? paymentProviderLabels[key] ?? '其他服务商';
}
