import Credential, { Config as CredentialConfig } from '@alicloud/credentials';
import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';
import type { WorkerEnv } from './types';

export type VerificationPurpose = 'registration' | 'password_reset' | 'phone_change';

export interface SmsDeliveryResult {
  provider: 'debug' | 'aliyun';
  providerMessageId?: string;
  providerRequestId?: string;
  debugCode?: string;
}

interface SmsClient {
  sendSmsWithOptions(request: SendSmsRequest, runtime: Util.RuntimeOptions): Promise<{ body?: { code?: string; message?: string; bizId?: string; requestId?: string } }>;
}

export class SmsDeliveryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SmsDeliveryError';
    this.code = code;
  }
}

export function smsProviderAvailable(env: WorkerEnv): boolean {
  if (debugProvider(env)) return true;
  return env.SMS_PROVIDER === 'aliyun' && Boolean(env.ALIYUN_SMS_SIGN_NAME && env.ALIYUN_SMS_TEMPLATE_CODE_VERIFICATION);
}

export async function sendVerificationSms(
  env: WorkerEnv,
  input: { mobile: string; code: string; challengeId: string; purpose: VerificationPurpose },
  clientFactory: (env: WorkerEnv) => SmsClient = createAliyunClient
): Promise<SmsDeliveryResult> {
  if (debugProvider(env)) return { provider: 'debug', debugCode: input.code };
  if (env.SMS_PROVIDER !== 'aliyun') throw new SmsDeliveryError('SMS_PROVIDER_NOT_CONFIGURED', '短信服务尚未配置');
  const signName = required(env.ALIYUN_SMS_SIGN_NAME, 'ALIYUN_SMS_SIGN_NAME');
  const templateCode = required(env.ALIYUN_SMS_TEMPLATE_CODE_VERIFICATION, 'ALIYUN_SMS_TEMPLATE_CODE_VERIFICATION');
  try {
    const response = await clientFactory(env).sendSmsWithOptions(
      new SendSmsRequest({
        phoneNumbers: input.mobile,
        signName,
        templateCode,
        templateParam: JSON.stringify({ code: input.code }),
        outId: input.challengeId,
      }),
      new Util.RuntimeOptions({ autoretry: false, maxAttempts: 1, connectTimeout: 3000, readTimeout: 3000 })
    );
    const body = response.body;
    if (body?.code !== 'OK' || !body.bizId) {
      throw new SmsDeliveryError(safeProviderCode(body?.code), '验证码发送失败，请稍后重试');
    }
    return { provider: 'aliyun', providerMessageId: body.bizId, providerRequestId: body.requestId };
  } catch (error) {
    if (error instanceof SmsDeliveryError) throw error;
    throw new SmsDeliveryError('ALIYUN_SMS_UNAVAILABLE', '短信服务暂时不可用，请稍后重试');
  }
}

function createAliyunClient(env: WorkerEnv): SmsClient {
  const credential = createCredential(env);
  const config = new OpenApi.Config({
    credential,
    endpoint: env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com',
    regionId: env.ALIYUN_SMS_REGION_ID || 'cn-hangzhou',
    protocol: 'https',
    connectTimeout: 3000,
    readTimeout: 3000,
  });
  return new Dysmsapi20170525(config);
}

function createCredential(env: WorkerEnv): Credential {
  if (env.ALIYUN_SMS_ACCESS_KEY_ID && env.ALIYUN_SMS_ACCESS_KEY_SECRET) {
    return new Credential(new CredentialConfig({ type: 'access_key', accessKeyId: env.ALIYUN_SMS_ACCESS_KEY_ID, accessKeySecret: env.ALIYUN_SMS_ACCESS_KEY_SECRET }));
  }
  if (env.ALIYUN_SMS_ECS_RAM_ROLE) {
    return new Credential(new CredentialConfig({ type: 'ecs_ram_role', roleName: env.ALIYUN_SMS_ECS_RAM_ROLE, enableIMDSv2: true, disableIMDSv1: true }));
  }
  return new Credential();
}

function debugProvider(env: WorkerEnv): boolean {
  return (env.APP_ENV === 'development' || env.APP_ENV === 'test') && (env.SMS_PROVIDER === undefined || env.SMS_PROVIDER === 'debug');
}

function required(value: string | undefined, name: string): string {
  const result = value?.trim();
  if (!result) throw new SmsDeliveryError('SMS_PROVIDER_NOT_CONFIGURED', `${name} is required`);
  return result;
}

function safeProviderCode(value: string | undefined): string {
  const normalized = (value || '')
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .slice(0, 80);
  return normalized ? `ALIYUN_SMS_${normalized}` : 'ALIYUN_SMS_REJECTED';
}
