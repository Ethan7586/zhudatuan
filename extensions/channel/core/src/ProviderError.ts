import { IntegrationFailure } from './integration';

export interface ProviderError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly providerStatus?: number;
}

export function mapProviderError(error: unknown): ProviderError {
  if (error instanceof IntegrationFailure) {
    return Object.freeze({ code: error.code, message: localizedMessage(error.code), retryable: error.retryable, ...(error.status === undefined ? {} : { providerStatus: error.status }) });
  }
  return Object.freeze({ code: 'PROVIDER_UNEXPECTED', message: localizedMessage('PROVIDER_UNEXPECTED'), retryable: false });
}

function localizedMessage(code: string): string {
  if (/CANCELLED/.test(code)) return '本次供应商操作已取消，未完成的任务不会继续执行。';
  if (/TIMEOUT|DEADLINE/.test(code)) return '该供应商响应超时，请稍后重试。';
  if (/AUTH|SIGNATURE|CONFIG|CREDENTIAL|SECRET/.test(code)) return '该供应商连接配置需要处理，请联系管理员。';
  if (/CIRCUIT|TRANSPORT|BULKHEAD|HTTP_(?:408|429|5\d\d)/.test(code)) return '该供应商暂时不可用，请稍后重试或选择其他商品。';
  return '供应商返回了无法处理的结果，请联系管理员。';
}
