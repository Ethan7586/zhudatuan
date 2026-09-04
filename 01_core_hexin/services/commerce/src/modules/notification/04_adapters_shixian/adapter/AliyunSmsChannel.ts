import Credential, { Config as CredentialConfig } from '@alicloud/credentials';
import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { DeliveryChannel } from '../../01_public_gongkai/DeliveryChannel';
import { Executor } from '../../../../foundation/performance/Executor';

const CredentialClient = defaultConstructor(Credential);
const SmsClient = defaultConstructor(Dysmsapi20170525);

export interface AliyunSmsConfiguration {
  readonly signName: string;
  readonly verificationTemplate: string;
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId?: string;
  readonly accessKeySecret?: string;
  readonly roleName?: string;
}

export class AliyunSmsChannel implements DeliveryChannel {
  readonly id = 'sms' as const;
  private readonly client: Dysmsapi20170525;
  private readonly executor = new Executor();

  constructor(private readonly configuration: AliyunSmsConfiguration) {
    const credential = configuration.accessKeyId && configuration.accessKeySecret
      ? new CredentialClient(new CredentialConfig({ type: 'access_key', accessKeyId: configuration.accessKeyId, accessKeySecret: configuration.accessKeySecret }))
      : configuration.roleName ? new CredentialClient(new CredentialConfig({ type: 'ecs_ram_role', roleName: configuration.roleName, enableIMDSv2: true, disableIMDSv1: true }))
        : new CredentialClient();
    this.client = new SmsClient(new OpenApi.Config({ credential, endpoint: required(configuration.endpoint), regionId: required(configuration.region),
      protocol: 'https', connectTimeout: RUNTIME_LIMITS.external.connectionTimeoutMilliseconds,
      readTimeout: RUNTIME_LIMITS.external.responseTimeoutMilliseconds }));
  }

  async send(request: Parameters<DeliveryChannel['send']>[0]) {
    try {
      const response = await this.executor.run(() => this.client.sendSmsWithOptions(new SendSmsRequest({ phoneNumbers: request.recipient,
        signName: required(this.configuration.signName), templateCode: request.providerTemplate ?? required(this.configuration.verificationTemplate),
        templateParam: JSON.stringify(request.variables), outId: request.idempotency }),
      new Util.RuntimeOptions({ autoretry: false, maxAttempts: 1, connectTimeout: RUNTIME_LIMITS.external.connectionTimeoutMilliseconds,
        readTimeout: RUNTIME_LIMITS.external.responseTimeoutMilliseconds })),
      { mode: 'businesskeywrite', retryable });
      const body = response.body;
      if (body?.code !== 'OK' || !body.bizId) throw new Error(providerRejection(body?.code));
      return { provider: 'aliyun', externalId: body.bizId };
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('ALIYUN_SMS_')) throw cause;
      const providerCode = typeof cause === 'object' && cause !== null && 'code' in cause
        ? (cause as { readonly code?: unknown }).code
        : undefined;
      if (typeof providerCode === 'string' && /^isv\./i.test(providerCode)) {
        throw new Error(providerRejection(providerCode));
      }
      throw new Error('ALIYUN_SMS_UNAVAILABLE');
    }
  }
}

function required(value: string): string { if (!value?.trim()) throw new Error('ALIYUN_SMS_CONFIGURATION_INVALID'); return value.trim(); }
function defaultConstructor<T>(value: T): T { return (value as unknown as { readonly default?: T }).default ?? value; }
function providerRejection(value: string | undefined): string {
  const normalized = (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9_.-]/g, '').slice(0, 80);
  return normalized ? `ALIYUN_SMS_${normalized}` : 'ALIYUN_SMS_REJECTED';
}
function retryable(cause: unknown): boolean {
  const code = cause instanceof Error ? cause.message : '';
  return /(?:timeout|throttl|network|connection|5\d\d)/i.test(code);
}
