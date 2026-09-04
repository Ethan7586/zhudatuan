import type { DeliveryChannel, DeliveryRequest } from '@shop/contract';
import { Bulkhead, CircuitBreaker, Deadline, RateLimiter, retry } from '@shop/kernel';
import { HttpTransport, type Transport } from '@shop/sdk';
import type { SmsConfiguration, SmsCredential } from './Config';
import { EcsCredentialProvider, StaticCredentialProvider, type SmsCredentialProvider } from './Credential';
import { SMS_POLICY } from './Manifest';
import { sendAliyunSms } from './Request';
import { parseSmsProviderReceipt } from './Receipt';
import { SmsTemplateCatalog } from './Template';

export class SmsClient implements DeliveryChannel {
  readonly id = 'sms' as const;
  readonly provider = 'aliyun';
  readonly priority = 10;
  private readonly credential: SmsCredentialProvider;
  private readonly bulkhead = new Bulkhead(SMS_POLICY.rateLimits.maxConcurrency, SMS_POLICY.rateLimits.maxQueue);
  private readonly rate = new RateLimiter(SMS_POLICY.rateLimits.requestsPerSecond);
  private readonly circuit = new CircuitBreaker(SMS_POLICY.circuitPolicy.failureThreshold, SMS_POLICY.circuitPolicy.recoveryMs);
  private readonly templates: SmsTemplateCatalog;

  constructor(
    private readonly configuration: SmsConfiguration,
    credential: SmsCredential | null,
    private readonly transport: Transport = new HttpTransport()
  ) {
    this.credential = credential ? new StaticCredentialProvider(credential) : new EcsCredentialProvider(configuration.roleName!);
    this.templates = new SmsTemplateCatalog(configuration);
  }

  async send(request: DeliveryRequest) {
    if (!/^\+?[1-9]\d{5,19}$/.test(request.recipient) || !request.idempotency.trim()) {
      throw new Error('ALIYUN_SMS_REQUEST_INVALID');
    }
    const deadline = Deadline.at(Math.min(request.deadline ?? Number.MAX_SAFE_INTEGER, Date.now() + SMS_POLICY.timeout.totalMs), request.signal);
    try {
      await this.rate.acquire(deadline);
      return await this.bulkhead.run(
        () =>
          this.circuit.run(() =>
            retry(() => this.deliver(request, deadline.signal), {
              mode: 'businesskeywrite',
              attempts: SMS_POLICY.retryPolicy.maxAttempts,
              minimumDelayMilliseconds: SMS_POLICY.retryPolicy.minimumDelayMs,
              maximumDelayMilliseconds: SMS_POLICY.retryPolicy.maximumDelayMs,
              deadline,
              retryable,
            })
          ),
        deadline.signal
      );
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('ALIYUN_SMS_')) throw cause;
      throw new Error('ALIYUN_SMS_UNAVAILABLE', { cause });
    } finally {
      deadline.dispose();
    }
  }

  circuitState() {
    return this.circuit.snapshot();
  }
  pressure() {
    return this.bulkhead.snapshot();
  }

  receipt(value: unknown) {
    return parseSmsProviderReceipt(value, this.configuration.optOut.keywords);
  }

  private async deliver(request: DeliveryRequest, signal: AbortSignal) {
    const template = this.templates.resolve(request);
    const credential = await this.credential.resolve(signal);
    const externalId = await sendAliyunSms(
      this.configuration.endpoint,
      {
        phoneNumbers: request.recipient,
        signName: this.configuration.signName,
        templateCode: template.code,
        templateParam: JSON.stringify(template.variables),
        outId: request.idempotency,
      },
      credential,
      signal,
      { ...(request.requestId ? { requestId: request.requestId } : {}), ...(request.traceId ? { traceId: request.traceId } : {}) },
      this.transport
    );
    return Object.freeze({ provider: 'aliyun', externalId });
  }
}
function retryable(cause: unknown): boolean {
  const code = cause instanceof Error ? cause.message : '';
  return /(?:timeout|throttl|network|connection|5\d\d)/i.test(code);
}
