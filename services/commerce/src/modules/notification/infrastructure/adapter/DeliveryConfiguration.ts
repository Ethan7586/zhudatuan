import type { AliyunSmsConfiguration } from './AliyunSmsChannel';
import type { EmailConfiguration } from './EmailChannel';
import type { WechatDeliveryConfiguration } from './WechatChannel';

export interface DeliveryConfiguration {
  readonly sms: AliyunSmsConfiguration;
  readonly email: EmailConfiguration;
  readonly wechat: WechatDeliveryConfiguration;
}

export function parseDeliveryConfiguration(source: string): DeliveryConfiguration {
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error('DELIVERY_CONFIGURATION_INVALID'); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('DELIVERY_CONFIGURATION_INVALID');
  const record = value as Readonly<Record<string, unknown>>;
  if (Object.keys(record).sort().join(',') !== 'email,sms,wechat' || !object(record.sms) || !object(record.email) || !object(record.wechat)) {
    throw new Error('DELIVERY_CONFIGURATION_INVALID');
  }
  return Object.freeze({ sms: record.sms as unknown as AliyunSmsConfiguration, email: record.email as unknown as EmailConfiguration,
    wechat: record.wechat as unknown as WechatDeliveryConfiguration });
}

function object(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
