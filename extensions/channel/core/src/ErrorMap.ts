import { IntegrationFailure } from './integration';

export interface ProviderError {
  readonly code: string;
  readonly retryable: boolean;
  readonly providerStatus?: number;
}

export function mapProviderError(error: unknown): ProviderError {
  if (error instanceof IntegrationFailure) return Object.freeze({ code: error.code, retryable: error.retryable, ...(error.status === undefined ? {} : { providerStatus: error.status }) });
  return Object.freeze({ code: 'PROVIDER_UNEXPECTED', retryable: false });
}
